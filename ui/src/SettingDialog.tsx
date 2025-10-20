import React from 'react';
import {
    Dialog,
    DialogTitle,
    DialogContent,
    TextField,
    DialogActions,
    Button,
    Autocomplete,
    Box,
} from '@mui/material';
import {
    CodecBestQuality,
    CodecDefault,
    codecName,
    loadSettings,
    PreferredCodec,
    Settings,
    VideoDisplayMode,
    VideoResolution,
} from './settings';
import {NumberField} from './NumberField';
import {useTranslation} from 'react-i18next';

export interface SettingDialogProps {
    open: boolean;
    setOpen: (open: boolean) => void;
    updateName: (s: string) => void;
    saveSettings: (s: Settings) => void;
}

const getAvailableCodecs = (): PreferredCodec[] => {
    if ('getCapabilities' in RTCRtpSender) {
        return RTCRtpSender.getCapabilities('video')?.codecs ?? [];
    }
    return [];
};

const NativeCodecs = getAvailableCodecs();

export const SettingDialog = ({open, setOpen, updateName, saveSettings}: SettingDialogProps) => {
    const {t} = useTranslation();
    const [settingsInput, setSettingsInput] = React.useState(loadSettings);

    const doSubmit = () => {
        saveSettings(settingsInput);
        updateName(settingsInput.name ?? '');
        setOpen(false);
    };

    const restoreDefaults = () => {
        const defaultSettings: Settings = {
            displayMode: VideoDisplayMode.FitToWindow,
            framerate: 30,
            preferCodec: CodecDefault,
            name: '',
            resolution: VideoResolution.R720p,
        };
        setSettingsInput(defaultSettings);
    };

    const {name, preferCodec, displayMode, framerate, resolution} = settingsInput;

    // 显示模式翻译函数
    const getDisplayModeLabel = (mode: VideoDisplayMode): string => {
        switch (mode) {
            case VideoDisplayMode.FitToWindow:
                return t('displayModeFitToWindow');
            case VideoDisplayMode.FitWidth:
                return t('displayModeFitWidth');
            case VideoDisplayMode.FitHeight:
                return t('displayModeFitHeight');
            case VideoDisplayMode.OriginalSize:
                return t('displayModeOriginalSize');
            default:
                return mode;
        }
    };

    // 分辨率翻译函数
    const getResolutionLabel = (res: VideoResolution): string => {
        switch (res) {
            case VideoResolution.R720p:
                return '720p';
            case VideoResolution.R1080p:
                return '1080p';
            case VideoResolution.R1440p:
                return '1440p';
            default:
                return res;
        }
    };

    return (
        <Dialog open={open} onClose={() => setOpen(false)} maxWidth={'xs'} fullWidth>
            <DialogTitle>{t('settings')}</DialogTitle>
            <DialogContent>
                <form onSubmit={doSubmit}>
                    <Box paddingBottom={1}>
                        <TextField
                            autoFocus
                            margin="dense"
                            label={t('username')}
                            value={name}
                            onChange={(e) =>
                                setSettingsInput((c) => ({...c, name: e.target.value}))
                            }
                            fullWidth
                        />
                    </Box>
                    {NativeCodecs.length > 0 ? (
                        <Box paddingY={1}>
                            <Autocomplete<PreferredCodec>
                                options={[CodecBestQuality, CodecDefault, ...NativeCodecs]}
                                getOptionLabel={({mimeType, sdpFmtpLine}) =>
                                    codecName(mimeType) + (sdpFmtpLine ? ` (${sdpFmtpLine})` : '')
                                }
                                value={preferCodec}
                                isOptionEqualToValue={(a, b) =>
                                    a.mimeType === b.mimeType && a.sdpFmtpLine === b.sdpFmtpLine
                                }
                                fullWidth
                                onChange={(_, value) =>
                                    setSettingsInput((c) => ({
                                        ...c,
                                        preferCodec: value ?? undefined,
                                    }))
                                }
                                renderInput={(params) => (
                                    <TextField {...params} label={t('preferredCodec')} />
                                )}
                            />
                        </Box>
                    ) : undefined}
                    <Box paddingTop={1}>
                        <Autocomplete<VideoDisplayMode>
                            options={Object.values(VideoDisplayMode)}
                            getOptionLabel={getDisplayModeLabel}
                            onChange={(_, value) =>
                                setSettingsInput((c) => ({
                                    ...c,
                                    displayMode: value ?? VideoDisplayMode.FitToWindow,
                                }))
                            }
                            value={displayMode}
                            fullWidth
                            renderInput={(params) => <TextField {...params} label={t('displayMode')} />}
                        />
                    </Box>
                    <Box paddingTop={1}>
                        <NumberField
                            label={t('frameRate')}
                            min={1}
                            onChange={(framerate) => setSettingsInput((c) => ({...c, framerate}))}
                            value={framerate}
                            fullWidth
                        />
                    </Box>
                    <Box paddingTop={1}>
                        <Autocomplete<VideoResolution>
                            options={Object.values(VideoResolution)}
                            getOptionLabel={getResolutionLabel}
                            onChange={(_, value) =>
                                setSettingsInput((c) => ({
                                    ...c,
                                    resolution: value ?? VideoResolution.R720p,
                                }))
                            }
                            value={resolution}
                            fullWidth
                            renderInput={(params) => <TextField {...params} label={t('resolution')} />}
                        />
                    </Box>
                </form>
            </DialogContent>
            <DialogActions>
                <Button onClick={restoreDefaults} color="secondary">
                    {t('restoreDefaults')}
                </Button>
                <Button onClick={() => setOpen(false)} color="primary">
                    {t('cancel')}
                </Button>
                <Button onClick={doSubmit} color="primary">
                    {t('save')}
                </Button>
            </DialogActions>
        </Dialog>
    );
};
