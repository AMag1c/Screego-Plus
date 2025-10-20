import React from 'react';
import {
    Box,
    Button,
    FormControl,
    Grid,
    Paper,
    TextField,
    Typography,
    Link,
} from '@mui/material';
import {FCreateRoom, UseRoom} from './useRoom';
import {UIConfig} from './message';
import {getRoomFromURL} from './useRoomID';
import {authModeToRoomMode, UseConfig} from './useConfig';
import {useTranslation} from 'react-i18next';
import {LanguageSelector} from './LanguageSelector';
import {RoomList} from './RoomList';
import {loadSettings, saveSettings} from './settings';

const CreateRoom = ({room, config}: Pick<UseRoom, 'room'> & {config: UIConfig}) => {
    const {t} = useTranslation();
    const [id, setId] = React.useState(() => getRoomFromURL() ?? config.roomName);
    const [username, setUsername] = React.useState(() => loadSettings().name || '');
    const mode = authModeToRoomMode(config.authMode, config.loggedIn);
    const submit = () => {
        // 保存用户名到localStorage
        if (username) {
            const settings = loadSettings();
            settings.name = username;
            saveSettings(settings);
        }

        room({
            type: 'create',
            payload: {
                mode,
                closeOnOwnerLeave: false,  // 始终为false，不再提供选项
                joinIfExist: true,
                id: id || undefined,
                username: username || undefined,
            },
        });
    };
    return (
        <div>
            <FormControl fullWidth>
                <TextField
                    fullWidth
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    label={t('username')}
                    margin="dense"
                    placeholder={t('usernameOptional')}
                />
                <TextField
                    fullWidth
                    value={id}
                    onChange={(e) => setId(e.target.value)}
                    label={t('id')}
                    margin="dense"
                />
                <Box paddingBottom={0.5}>
                    <Typography>
                        {t('natTraversal')}:{' '}
                        <Link
                            href="https://screego.net/#/nat-traversal"
                            target="_blank"
                            rel="noreferrer"
                        >
                            {mode.toUpperCase()}
                        </Link>
                    </Typography>
                </Box>
                <Button onClick={submit} fullWidth variant="contained">
                    {t('createOrJoinRoom')}
                </Button>
            </FormControl>
        </div>
    );
};

export const RoomManage = ({room, config}: {room: FCreateRoom; config: UseConfig}) => {
    const {t} = useTranslation();

    return (
        <Grid
            container={true}
            justifyContent="center"
            style={{paddingTop: 50, maxWidth: 400, width: '100%', margin: '0 auto', position: 'relative'}}
            spacing={4}
        >
            {/* 语言切换器 - 右上角 */}
            <div style={{position: 'absolute', top: 20, right: 20}}>
                <LanguageSelector />
            </div>

            <Grid size={12}>
                <Typography align="center" gutterBottom>
                    <img src="./logo.svg" style={{width: 230}} alt="logo" />
                </Typography>
                <Paper elevation={3} style={{padding: 20}}>
                    <CreateRoom room={room} config={config} />
                </Paper>
            </Grid>

            {/* 房间列表 */}
            <Grid size={12}>
                <RoomList room={room} />
            </Grid>

            {/* 版本信息 - 简单放在房间列表下面 */}
            <div style={{textAlign: 'center', marginTop: '20px'}}>
                {t('screegoVersion')} {config.version} |{' '}
                <Link href="https://github.com/screego/server/">GitHub</Link>
            </div>
        </Grid>
    );
};
