import {useSnackbar} from 'notistack';
import React from 'react';
import {useTranslation} from 'react-i18next';

import {
    ICEServer,
    IncomingMessage,
    JoinRoom,
    OutgoingMessage,
    RoomCreate,
    RoomInfo,
    UIConfig,
} from './message';
import {loadSettings, resolveCodecPlaceholder} from './settings';
import {urlWithSlash} from './url';
import {authModeToRoomMode} from './useConfig';
import {getFromURL, useRoomID} from './useRoomID';

export type RoomState = false | ConnectedRoom;
export type ConnectedRoom = {
    ws: WebSocket;
    hostStream?: MediaStream;
    clientStreams: ClientStream[];
} & RoomInfo;

interface ClientStream {
    id: string;
    peer_id: string;
    stream: MediaStream;
}

export interface UseRoom {
    state: RoomState;
    room: FCreateRoom;
    share: () => void;
    setName: (name: string) => void;
    stopShare: () => void;
    exitRoom: () => void;
    dissolveRoom: () => void;
    ownerAction: (action: string, targetUserId?: string) => void;
}

const relayConfig: Partial<RTCConfiguration> =
    window.location.search.indexOf('forceTurn=true') !== -1 ? {iceTransportPolicy: 'relay'} : {};

const hostSession = async ({
    sid,
    ice,
    send,
    done,
    stream,
}: {
    sid: string;
    ice: ICEServer[];
    send: (e: OutgoingMessage) => void;
    done: () => void;
    stream: MediaStream;
}): Promise<RTCPeerConnection> => {
    const peer = new RTCPeerConnection({...relayConfig, iceServers: ice});
    peer.onicecandidate = (event) => {
        if (!event.candidate) {
            return;
        }
        send({type: 'hostice', payload: {sid: sid, value: event.candidate}});
    };

    peer.onconnectionstatechange = (event) => {
        console.log('host change', event);
        if (
            peer.connectionState === 'closed' ||
            peer.connectionState === 'disconnected' ||
            peer.connectionState === 'failed'
        ) {
            peer.close();
            done();
        }
    };

    stream.getTracks().forEach((track) => peer.addTrack(track, stream));

    const preferCodec = resolveCodecPlaceholder(loadSettings().preferCodec);
    if (preferCodec) {
        const transceiver = peer
            .getTransceivers()
            .find((t) => t.sender && t.sender.track === stream.getVideoTracks()[0]);

        if (!!transceiver && 'setCodecPreferences' in transceiver) {
            const exactMatch: RTCRtpCodec[] = [];
            const mimeMatch: RTCRtpCodec[] = [];
            const others: RTCRtpCodec[] = [];

            RTCRtpReceiver.getCapabilities('video')?.codecs.forEach((codec) => {
                if (codec.mimeType === preferCodec.mimeType) {
                    if (codec.sdpFmtpLine === preferCodec.sdpFmtpLine) {
                        exactMatch.push(codec);
                    } else {
                        mimeMatch.push(codec);
                    }
                } else {
                    others.push(codec);
                }
            });

            const sortedCodecs = [...exactMatch, ...mimeMatch, ...others];

            console.log('Setting codec preferences', sortedCodecs);
            transceiver.setCodecPreferences(sortedCodecs);
        }
    }

    const hostOffer = await peer.createOffer({offerToReceiveVideo: true});
    await peer.setLocalDescription(hostOffer);
    send({type: 'hostoffer', payload: {value: hostOffer, sid: sid}});

    return peer;
};

const clientSession = async ({
    sid,
    ice,
    send,
    done,
    onTrack,
}: {
    sid: string;
    ice: ICEServer[];
    send: (e: OutgoingMessage) => void;
    onTrack: (s: MediaStream) => void;
    done: () => void;
}): Promise<RTCPeerConnection> => {
    console.log('ice', ice);
    const peer = new RTCPeerConnection({...relayConfig, iceServers: ice});
    peer.onicecandidate = (event) => {
        if (!event.candidate) {
            return;
        }
        send({type: 'clientice', payload: {sid: sid, value: event.candidate}});
    };
    peer.onconnectionstatechange = (event) => {
        console.log('client change', event);
        if (
            peer.connectionState === 'closed' ||
            peer.connectionState === 'disconnected' ||
            peer.connectionState === 'failed'
        ) {
            peer.close();
            done();
        }
    };

    let notified = false;
    const stream = new MediaStream();
    peer.ontrack = (event) => {
        stream.addTrack(event.track);
        if (!notified) {
            notified = true;
            onTrack(stream);
        }
    };

    return peer;
};

export type FCreateRoom = (room: RoomCreate | JoinRoom) => Promise<void>;

export const useRoom = (config: UIConfig): UseRoom => {
    const {t} = useTranslation();
    const [roomID, setRoomID] = useRoomID();
    const {enqueueSnackbar} = useSnackbar();
    const conn = React.useRef<WebSocket | undefined>(undefined);
    const host = React.useRef<Record<string, RTCPeerConnection>>({});
    const client = React.useRef<Record<string, RTCPeerConnection>>({});
    const stream = React.useRef<MediaStream>(undefined);

    const [state, setState] = React.useState<RoomState>(false);

    const room: FCreateRoom = React.useCallback(
        (create) => {
            return new Promise<void>((resolve) => {
                const ws = (conn.current = new WebSocket(
                    urlWithSlash.replace('http', 'ws') + 'stream'
                ));
                const send = (message: OutgoingMessage) => {
                    if (ws.readyState === ws.OPEN) ws.send(JSON.stringify(message));
                };
                let first = true;
                ws.onmessage = (data) => {
                    const event: IncomingMessage = JSON.parse(data.data);
                    if (first) {
                        first = false;
                        if (event.type === 'room') {
                            resolve();
                            setState({ws, ...event.payload, clientStreams: []});
                            setRoomID(event.payload.id);
                        } else {
                            resolve();
                            enqueueSnackbar(`${t('unknownEvent')}: ${event.type}`, {variant: 'error', autoHideDuration: 10000});
                            ws.close(1000, 'received unknown event');
                        }
                        return;
                    }

                    switch (event.type) {
                        case 'room':
                            setState((current) =>
                                current ? {...current, ...event.payload} : current
                            );
                            return;
                        case 'hostsession':
                            if (!stream.current) {
                                return;
                            }
                            hostSession({
                                sid: event.payload.id,
                                stream: stream.current!,
                                ice: event.payload.iceServers,
                                send,
                                done: () => delete host.current[event.payload.id],
                            }).then((peer) => {
                                host.current[event.payload.id] = peer;
                            });
                            return;
                        case 'clientsession':
                            const {id: sid, peer} = event.payload;
                            clientSession({
                                sid,
                                send,
                                ice: event.payload.iceServers,
                                done: () => {
                                    delete client.current[sid];
                                    setState((current) =>
                                        current
                                            ? {
                                                  ...current,
                                                  clientStreams: current.clientStreams.filter(
                                                      ({id}) => id !== sid
                                                  ),
                                              }
                                            : current
                                    );
                                },
                                onTrack: (stream) =>
                                    setState((current) =>
                                        current
                                            ? {
                                                  ...current,
                                                  clientStreams: [
                                                      ...current.clientStreams,
                                                      {
                                                          id: sid,
                                                          stream,
                                                          peer_id: peer,
                                                      },
                                                  ],
                                              }
                                            : current
                                    ),
                            }).then((peer) => (client.current[event.payload.id] = peer));
                            return;
                        case 'clientice':
                            host.current[event.payload.sid]?.addIceCandidate(event.payload.value);
                            return;
                        case 'clientanswer':
                            host.current[event.payload.sid]?.setRemoteDescription(
                                event.payload.value
                            );
                            return;
                        case 'hostoffer':
                            (async () => {
                                await client.current[event.payload.sid]?.setRemoteDescription(
                                    event.payload.value
                                );
                                const answer =
                                    await client.current[event.payload.sid]?.createAnswer();
                                await client.current[event.payload.sid]?.setLocalDescription(
                                    answer
                                );
                                send({
                                    type: 'clientanswer',
                                    payload: {sid: event.payload.sid, value: answer},
                                });
                            })();
                            return;
                        case 'hostice':
                            client.current[event.payload.sid]?.addIceCandidate(event.payload.value);
                            return;
                        case 'endshare':
                            client.current[event.payload]?.close();
                            host.current[event.payload]?.close();
                            setState((current) =>
                                current
                                    ? {
                                          ...current,
                                          clientStreams: current.clientStreams.filter(
                                              ({id}) => id !== event.payload
                                          ),
                                      }
                                    : current
                            );
                            return;
                        case 'dissolve':
                            // Handle dissolve room acknowledgment
                            enqueueSnackbar(t('roomDissolved'), {variant: 'success'});
                            // Exit the room after dissolution
                            exitRoom();
                            return;
                        case 'Error':
                            // 处理后端错误消息
                            let errorMessage = event.payload.message;

                            // 翻译特定的错误消息
                            const errorTranslations: Record<string, string> = {
                                'another user is already sharing screen': t('alreadySharing'),
                                'bannedFromRoom': t('bannedByOwner'),
                                'you do not have permission to share screen': t('noPermissionToShare'),
                                'cannot join room, you are already in one': t('alreadyInRoom'),
                                'only owner can perform this action': t('onlyOwnerCanDissolve'),
                                'targetUserId is required for individual actions': t('targetUserIdRequired'),
                                'invalid user ID': t('invalidUserId'),
                                'user not found': t('userNotFound'),
                                'cannot perform action on yourself': t('cannotActionOnYourself'),
                                'you are not in a room': t('notInRoom'),
                                'you are not in this room': t('notInThisRoom'),
                                'only the room owner can dissolve the room': t('onlyOwnerCanDissolve'),
                                'not connected': t('notConnected'),
                                'permission denied': t('permissionDenied'),
                            };

                            // 检查是否是"房间不存在"错误
                            if (errorMessage.includes('does not exist') || errorMessage.includes('does already exist')) {
                                if (errorMessage.includes('does not exist')) {
                                    errorMessage = t('roomNotExist');
                                } else {
                                    errorMessage = t('roomAlreadyExists');
                                }
                                // 显示错误提示
                                enqueueSnackbar(errorMessage, {variant: 'error', autoHideDuration: 10000});
                                // 清除URL参数并跳转回主页
                                setRoomID(undefined);
                                setState(false);
                                return;
                            }

                            // 应用翻译
                            errorMessage = errorTranslations[errorMessage] || errorMessage;

                            enqueueSnackbar(errorMessage, {variant: 'error', autoHideDuration: 10000});
                            return;
                        default:
                            // Handle unknown message types
                            const unknownEvent = event as any;
                            enqueueSnackbar(`${t('malformedMessage')}: ${unknownEvent.type}`, {variant: 'error', autoHideDuration: 10000});
                    }
                };
                ws.onclose = (event) => {
                    if (first) {
                        resolve();
                        first = false;
                    }
                    // 翻译后端返回的关闭原因
                    let message = event.reason;

                    // 翻译映射表
                    const closeReasonTranslations: Record<string, string> = {
                        'Room Dissolved': t('roomDissolvedByOwner'),
                        'User Left': t('userLeft'),
                        'kickedByOwner': t('kickedByOwner'),
                        'bannedByOwner': t('bannedByOwner'),
                        'bannedFromRoom': t('bannedByOwner'),
                    };

                    // 检查是否是"房间不存在"错误
                    if (message.includes('does not exist')) {
                        message = t('roomNotExist');
                        enqueueSnackbar(message, {variant: 'error', autoHideDuration: 10000});
                        // 清除URL参数并跳转回主页
                        setRoomID(undefined);
                        setState(false);
                        return;
                    }

                    // 应用翻译
                    message = closeReasonTranslations[message] || message;

                    if (message && message.trim()) {
                        const isInfo = message === t('roomDissolvedByOwner');
                        enqueueSnackbar(message, {
                            variant: isInfo ? 'info' : 'error',
                            autoHideDuration: isInfo ? 4000 : 10000
                        });
                    }
                    setState(false);
                };
                ws.onerror = (err) => {
                    if (first) {
                        resolve();
                        first = false;
                    }
                    enqueueSnackbar(err?.toString(), {variant: 'error', autoHideDuration: 10000});
                    setState(false);
                };
                ws.onopen = () => {
                    // 如果没有提供username，则从settings读取
                    if (!create.payload.username) {
                        create.payload.username = loadSettings().name;
                    }
                    send(create);
                };
            });
        },
        [setState, enqueueSnackbar, setRoomID]
    );

    const share = async () => {
        if (!navigator.mediaDevices) {
            enqueueSnackbar(
                t('couldNotStartPresentationHTTPS'),
                {variant: 'error', autoHideDuration: 10000}
            );
            return;
        }
        if (typeof navigator.mediaDevices.getDisplayMedia !== 'function') {
            enqueueSnackbar(
                `${t('couldNotStartPresentationBrowser')} (mediaDevices.getDeviceMedia ${typeof navigator.mediaDevices.getDisplayMedia})`,
                {variant: 'error', autoHideDuration: 10000}
            );
            return;
        }
        try {
            const settings = loadSettings();

            // 根据分辨率设置获取宽高
            let width = 1280, height = 720;
            if (settings.resolution === '1080p') {
                width = 1920;
                height = 1080;
            } else if (settings.resolution === '1440p') {
                width = 2560;
                height = 1440;
            }

            stream.current = await navigator.mediaDevices.getDisplayMedia({
                video: {
                    frameRate: settings.framerate,
                    width: {ideal: width},
                    height: {ideal: height},
                },
                audio: {
                    echoCancellation: false,
                    autoGainControl: false,
                    noiseSuppression: false,
                    // https://medium.com/@trystonperry/why-is-getdisplaymedias-audio-quality-so-bad-b49ba9cfaa83
                    // @ts-expect-error
                    googAutoGainControl: false,
                },
            });
        } catch (e) {
            console.log('Could not getDisplayMedia', e);
            enqueueSnackbar(`${t('couldNotStartPresentationError')}. ${e}`, {
                variant: 'error',
                autoHideDuration: 10000,
            });
            return;
        }

        stream.current?.getVideoTracks()[0].addEventListener('ended', () => stopShare());
        setState((current) => (current ? {...current, hostStream: stream.current} : current));

        conn.current?.send(JSON.stringify({type: 'share', payload: {}}));
    };

    const stopShare = async () => {
        Object.values(host.current).forEach((peer) => {
            peer.close();
        });
        host.current = {};
        stream.current?.getTracks().forEach((track) => track.stop());
        stream.current = undefined;
        conn.current?.send(JSON.stringify({type: 'stopshare', payload: {}}));
        setState((current) => (current ? {...current, hostStream: undefined} : current));
    };

    const setName = (name: string): void => {
        conn.current?.send(JSON.stringify({type: 'name', payload: {username: name}}));
    };

    const exitRoom = (): void => {
        // 如果正在共享，停止共享
        if (stream.current) {
            stopShare();
        }

        // 关闭所有连接
        Object.values(host.current).forEach((peer) => {
            peer.close();
        });
        Object.values(client.current).forEach((peer) => {
            peer.close();
        });
        host.current = {};
        client.current = {};

        // 关闭WebSocket连接
        if (conn.current) {
            conn.current.close();
            conn.current = undefined;
        }

        // 重置状态
        setState(false);

        // 清除URL参数，返回房间管理页面
        setRoomID(undefined);
    };

    const dissolveRoom = (): void => {
        // 发送解散房间消息到服务器
        if (conn.current && conn.current.readyState === conn.current.OPEN) {
            conn.current.send(JSON.stringify({type: 'dissolve', payload: {}}));
        }

        // 然后执行退出房间逻辑
        exitRoom();
    };

    const ownerAction = (action: string, targetUserId?: string): void => {
        // 发送房主操作消息到服务器
        if (conn.current && conn.current.readyState === conn.current.OPEN) {
            conn.current.send(JSON.stringify({
                type: 'owneraction',
                payload: {
                    action: action,
                    targetUserId: targetUserId || ''
                }
            }));
        }
    };

    React.useEffect(() => {
        if (roomID) {
            const create = getFromURL('create') === 'true';
            if (create) {
                const closeOnOwnerLeaveString = getFromURL('closeOnOwnerLeave');
                const closeOnOwnerLeave =
                    closeOnOwnerLeaveString === undefined
                        ? config.closeRoomWhenOwnerLeaves
                        : closeOnOwnerLeaveString === 'true';
                room({
                    type: 'create',
                    payload: {
                        joinIfExist: true,
                        closeOnOwnerLeave,
                        id: roomID,
                        mode: authModeToRoomMode(config.authMode, config.loggedIn),
                    },
                });
            } else {
                room({type: 'join', payload: {id: roomID}});
            }
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    return {state, room, share, stopShare, setName, exitRoom, dissolveRoom, ownerAction};
};
