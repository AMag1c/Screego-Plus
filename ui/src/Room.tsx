import React, {useCallback} from 'react';
import {Badge, Box, IconButton, Paper, Tooltip, Typography, Slider, Stack} from '@mui/material';
import CancelPresentationIcon from '@mui/icons-material/CancelPresentation';
import PresentToAllIcon from '@mui/icons-material/PresentToAll';
import FullScreenIcon from '@mui/icons-material/Fullscreen';
import PeopleIcon from '@mui/icons-material/People';
import VolumeMuteIcon from '@mui/icons-material/VolumeOff';
import VolumeIcon from '@mui/icons-material/VolumeUp';
import SettingsIcon from '@mui/icons-material/Settings';
import ExitToAppIcon from '@mui/icons-material/ExitToApp';
import LogoutIcon from '@mui/icons-material/Logout';
import {useHotkeys} from 'react-hotkeys-hook';
import {Video} from './Video';
import makeStyles from '@mui/styles/makeStyles';
import {ConnectedRoom} from './useRoom';
import {useSnackbar} from 'notistack';
import {RoomUser} from './message';
import {useSettings, VideoDisplayMode} from './settings';
import {SettingDialog} from './SettingDialog';
import {useTranslation} from 'react-i18next';

const HostStream: unique symbol = Symbol('mystream');

const flags = (user: RoomUser, t: (key: string) => string) => {
    const result: string[] = [];
    if (user.you) {
        result.push(t('you'));
    }
    if (user.owner) {
        result.push(t('owner'));
    }
    if (user.streaming) {
        result.push(t('streaming'));
    }
    if (!result.length) {
        return '';
    }
    return ` (${result.join(', ')})`;
};

interface FullScreenHTMLVideoElement extends HTMLVideoElement {
    msRequestFullscreen?: () => void;
    mozRequestFullScreen?: () => void;
    webkitRequestFullscreen?: () => void;
}

const requestFullscreen = (element: FullScreenHTMLVideoElement | null) => {
    if (element?.requestFullscreen) {
        element.requestFullscreen();
    } else if (element?.mozRequestFullScreen) {
        element.mozRequestFullScreen();
    } else if (element?.msRequestFullscreen) {
        element.msRequestFullscreen();
    } else if (element?.webkitRequestFullscreen) {
        element.webkitRequestFullscreen();
    }
};

export const Room = ({
    state,
    share,
    stopShare,
    setName,
    exitRoom,
    dissolveRoom,
}: {
    state: ConnectedRoom;
    share: () => void;
    stopShare: () => void;
    setName: (name: string) => void;
    exitRoom: () => void;
    dissolveRoom: () => void;
}) => {
    const {t} = useTranslation();
    const classes = useStyles();
    const [open, setOpen] = React.useState(false);
    const {enqueueSnackbar} = useSnackbar();
    const [settings, setSettings] = useSettings();
    const [showControl, setShowControl] = React.useState(true);
    const [hoverControl, setHoverControl] = React.useState(false);
    const [selectedStream, setSelectedStream] = React.useState<string | typeof HostStream>();
    const [videoElement, setVideoElement] = React.useState<FullScreenHTMLVideoElement | null>(null);

    useShowOnMouseMovement(setShowControl);

    const handleFullscreen = useCallback(() => requestFullscreen(videoElement), [videoElement]);

    React.useEffect(() => {
        if (selectedStream === HostStream && state.hostStream) {
            return;
        }
        if (state.clientStreams.some(({id}) => id === selectedStream)) {
            return;
        }
        if (state.clientStreams.length === 0 && selectedStream) {
            setSelectedStream(undefined);
            return;
        }
        setSelectedStream(state.clientStreams[0]?.id);
    }, [state.clientStreams, selectedStream, state.hostStream]);

    const stream =
        selectedStream === HostStream
            ? state.hostStream
            : state.clientStreams.find(({id}) => selectedStream === id)?.stream;

    React.useEffect(() => {
        if (videoElement && stream) {
            videoElement.srcObject = stream;
            videoElement.play().catch((err) => {
                console.log('Could not play main video', err);
                if (err.name === 'NotAllowedError') {
                    videoElement.muted = true;
                    videoElement
                        .play()
                        .catch((retryErr) =>
                            console.log('Could not play main video with mute', retryErr)
                        );
                }
            });
        }
    }, [videoElement, stream]);

    const copyLink = () => {
        navigator?.clipboard?.writeText(window.location.href)?.then(
            () => enqueueSnackbar(t('linkCopied'), {variant: 'success'}),
            (err) => enqueueSnackbar(t('copyFailed') + ' ' + err, {variant: 'error'})
        );
    };

    const setHoverState = React.useMemo(
        () => ({
            onMouseLeave: () => setHoverControl(false),
            onMouseEnter: () => setHoverControl(true),
        }),
        [setHoverControl]
    );

    const controlVisible = showControl || open || hoverControl;

    useHotkeys('s', () => (state.hostStream ? stopShare() : share()), [state.hostStream]);
    useHotkeys(
        'f',
        () => {
            if (selectedStream) {
                handleFullscreen();
            }
        },
        [handleFullscreen, selectedStream]
    );
    useHotkeys('c', copyLink);
    useHotkeys(
        'h',
        () => {
            if (state.clientStreams !== undefined && state.clientStreams.length > 0) {
                const currentStreamIndex = state.clientStreams.findIndex(
                    ({id}) => id === selectedStream
                );
                const nextIndex =
                    currentStreamIndex === state.clientStreams.length - 1
                        ? 0
                        : currentStreamIndex + 1;
                setSelectedStream(state.clientStreams[nextIndex].id);
            }
        },
        [state.clientStreams, selectedStream]
    );
    useHotkeys(
        'l',
        () => {
            if (state.clientStreams !== undefined && state.clientStreams.length > 0) {
                const currentStreamIndex = state.clientStreams.findIndex(
                    ({id}) => id === selectedStream
                );
                const previousIndex =
                    currentStreamIndex === 0
                        ? state.clientStreams.length - 1
                        : currentStreamIndex - 1;
                setSelectedStream(state.clientStreams[previousIndex].id);
            }
        },
        [state.clientStreams, selectedStream]
    );
    useHotkeys(
        'm',
        () => {
            if (videoElement) {
                videoElement.muted = !videoElement.muted;
            }
        },
        [videoElement]
    );

    const videoClasses = () => {
        switch (settings.displayMode) {
            case VideoDisplayMode.FitToWindow:
                return `${classes.video} ${classes.videoWindowFit}`;
            case VideoDisplayMode.OriginalSize:
                return `${classes.video}`;
            case VideoDisplayMode.FitWidth:
                return `${classes.video} ${classes.videoWindowWidth}`;
            case VideoDisplayMode.FitHeight:
                return `${classes.video} ${classes.videoWindowHeight}`;
        }
    };

    return (
        <div className={classes.videoContainer}>
            {controlVisible && (
                <Paper className={classes.title} elevation={10} {...setHoverState}>
                    <Tooltip title={t('copyLink')}>
                        <Typography
                            variant="h4"
                            component="h4"
                            style={{cursor: 'pointer'}}
                            onClick={copyLink}
                        >
                            {state.id}
                        </Typography>
                    </Tooltip>
                </Paper>
            )}

            {stream ? (
                <video
                    ref={setVideoElement}
                    className={videoClasses()}
                    onDoubleClick={handleFullscreen}
                />
            ) : (
                <Typography
                    variant="h4"
                    align="center"
                    component="div"
                    style={{
                        top: '50%',
                        left: '50%',
                        position: 'absolute',
                        transform: 'translate(-50%, -50%)',
                    }}
                >
                    {t('noStreamAvailable')}
                </Typography>
            )}

            {controlVisible && (
                <Paper className={classes.control} elevation={10} {...setHoverState}>
                    {(stream?.getAudioTracks().length ?? 0) > 0 && videoElement && (
                        <AudioControl video={videoElement} />
                    )}
                    <Box whiteSpace="nowrap">
                        {/* 检查是否有其他人在投屏 */}
                        {(() => {
                            const someoneElseStreaming = state.users.some(
                                (user) => user.streaming && !user.you
                            );

                            if (state.hostStream) {
                                // 自己正在投屏，显示停止按钮
                                return (
                                    <Tooltip title={t('cancelPresentation')} arrow>
                                        <IconButton onClick={stopShare} size="large">
                                            <CancelPresentationIcon fontSize="large" />
                                        </IconButton>
                                    </Tooltip>
                                );
                            } else if (someoneElseStreaming) {
                                // 其他人在投屏，隐藏开始按钮
                                return null;
                            } else {
                                // 没人投屏，显示开始按钮
                                return (
                                    <Tooltip title={t('startPresentation')} arrow>
                                        <IconButton onClick={share} size="large">
                                            <PresentToAllIcon fontSize="large" />
                                        </IconButton>
                                    </Tooltip>
                                );
                            }
                        })()}

                        <Tooltip
                            classes={{tooltip: classes.noMaxWidth}}
                            title={
                                <div>
                                    <Typography variant="h5">{t('memberList')}</Typography>
                                    {state.users.map((user) => (
                                        <Typography key={user.id}>
                                            {user.name} {flags(user, t)}
                                        </Typography>
                                    ))}
                                </div>
                            }
                            arrow
                        >
                            <Badge badgeContent={state.users.length} color="primary">
                                <PeopleIcon fontSize="large" />
                            </Badge>
                        </Tooltip>
                        <Tooltip title={t('fullscreen')} arrow>
                            <IconButton
                                onClick={() => handleFullscreen()}
                                disabled={!selectedStream}
                                size="large"
                            >
                                <FullScreenIcon fontSize="large" />
                            </IconButton>
                        </Tooltip>

                        <Tooltip title={t('settings')} arrow>
                            <IconButton onClick={() => setOpen(true)} size="large">
                                <SettingsIcon fontSize="large" />
                            </IconButton>
                        </Tooltip>

                        {/* 退出房间按钮 */}
                        <Tooltip title={t('exitRoom')} arrow>
                            <IconButton onClick={exitRoom} size="large">
                                <ExitToAppIcon fontSize="large" />
                            </IconButton>
                        </Tooltip>

                        {/* 房主解散房间按钮 */}
                        {state.users.find(u => u.you && u.owner) && (
                            <Tooltip title={t('dissolveRoom')} arrow>
                                <IconButton
                                    onClick={dissolveRoom}
                                    size="large"
                                    color="warning"
                                >
                                    <LogoutIcon fontSize="large" />
                                </IconButton>
                            </Tooltip>
                        )}
                    </Box>
                </Paper>
            )}

            <div className={classes.bottomContainer}>
                {state.clientStreams
                    .filter(({id}) => id !== selectedStream)
                    .map((client) => {
                        return (
                            <Paper
                                key={client.id}
                                elevation={4}
                                className={classes.smallVideoContainer}
                                onClick={() => setSelectedStream(client.id)}
                            >
                                <Video
                                    key={client.id}
                                    src={client.stream}
                                    className={classes.smallVideo}
                                />
                                <Typography
                                    variant="subtitle1"
                                    component="div"
                                    align="center"
                                    className={classes.smallVideoLabel}
                                >
                                    {state.users.find(({id}) => client.peer_id === id)?.name ??
                                        'unknown'}
                                </Typography>
                            </Paper>
                        );
                    })}
                {state.hostStream && selectedStream !== HostStream && (
                    <Paper
                        elevation={4}
                        className={classes.smallVideoContainer}
                        onClick={() => setSelectedStream(HostStream)}
                    >
                        <Video src={state.hostStream} className={classes.smallVideo} />
                        <Typography
                            variant="subtitle1"
                            component="div"
                            align="center"
                            className={classes.smallVideoLabel}
                        >
                            {t('you')}
                        </Typography>
                    </Paper>
                )}
                <SettingDialog
                    open={open}
                    setOpen={setOpen}
                    updateName={setName}
                    saveSettings={setSettings}
                />
            </div>
        </div>
    );
};

const useShowOnMouseMovement = (doShow: (s: boolean) => void) => {
    const timeoutHandle = React.useRef(0);

    React.useEffect(() => {
        const update = () => {
            if (timeoutHandle.current === 0) {
                doShow(true);
            }

            clearTimeout(timeoutHandle.current);
            timeoutHandle.current = window.setTimeout(() => {
                timeoutHandle.current = 0;
                doShow(false);
            }, 1000);
        };
        window.addEventListener('mousemove', update);
        return () => window.removeEventListener('mousemove', update);
    }, [doShow]);

    React.useEffect(
        () =>
            void (timeoutHandle.current = window.setTimeout(() => {
                timeoutHandle.current = 0;
                doShow(false);
            }, 1000)),
        // eslint-disable-next-line react-hooks/exhaustive-deps
        []
    );
};

const AudioControl = ({video}: {video: FullScreenHTMLVideoElement}) => {
    // this is used to force a rerender
    const [, setMuted] = React.useState<boolean>();

    React.useEffect(() => {
        const handler = () => setMuted(video.muted);
        video.addEventListener('volumechange', handler);
        setMuted(video.muted);
        return () => video.removeEventListener('volumechange', handler);
    });

    return (
        <Stack spacing={0.5} pr={2} direction="row" sx={{alignItems: 'center', my: 1, height: 35}}>
            <IconButton size="large" onClick={() => (video.muted = !video.muted)}>
                {video.muted ? (
                    <VolumeMuteIcon fontSize="large" />
                ) : (
                    <VolumeIcon fontSize="large" />
                )}
            </IconButton>
            <Slider
                min={0}
                max={1}
                step={0.01}
                defaultValue={video.volume}
                onChange={(_, newVolume) => {
                    video.muted = false;
                    video.volume = newVolume;
                }}
            />
        </Stack>
    );
};

const useStyles = makeStyles(() => ({
    title: {
        padding: 15,
        position: 'fixed',
        top: '30px',
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 30,
    },
    bottomContainer: {
        position: 'fixed',
        display: 'flex',
        bottom: 0,
        right: 0,
        zIndex: 20,
    },
    control: {
        padding: 15,
        position: 'fixed',
        bottom: '30px',
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 30,
    },
    video: {
        display: 'block',
        margin: '0 auto',

        '&::-webkit-media-controls-start-playback-button': {
            display: 'none!important',
        },
        '&::-webkit-media-controls': {
            display: 'none!important',
        },
    },
    smallVideo: {
        minWidth: '100%',
        minHeight: '100%',
        width: 'auto',
        maxWidth: '300px',

        maxHeight: '200px',
    },
    videoWindowFit: {
        width: '100%',
        height: '100%',

        position: 'absolute',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%,-50%)',
    },
    videoWindowWidth: {
        height: 'auto',
        width: '100%',
    },
    videoWindowHeight: {
        height: '100%',
        width: 'auto',
    },
    smallVideoLabel: {
        position: 'absolute',
        display: 'block',
        bottom: 0,
        background: 'rgba(0,0,0,.5)',
        padding: '5px 15px',
    },
    noMaxWidth: {
        maxWidth: 'none',
    },
    smallVideoContainer: {
        height: '100%',
        padding: 5,
        maxHeight: 200,
        maxWidth: 400,
        width: '100%',
    },
    videoContainer: {
        position: 'absolute',
        top: 0,
        bottom: 0,
        width: '100%',
        height: '100%',

        overflow: 'auto',
    },
}));
