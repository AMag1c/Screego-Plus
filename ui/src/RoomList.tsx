import {
    Box,
    Paper,
    List,
    ListItem,
    ListItemText,
    Button,
    Typography,
    IconButton,
    Chip,
    LinearProgress,
    Tooltip,
} from '@mui/material';
import RefreshIcon from '@mui/icons-material/Refresh';
import {useTranslation} from 'react-i18next';
import {useRoomList} from './useRoomList';

interface RoomListProps {
    room: (data: any) => Promise<void>;
}

export const RoomList = ({room}: RoomListProps) => {
    const {t} = useTranslation();
    const {rooms, loading, refreshRooms} = useRoomList();

    const handleJoinRoom = (roomId: string) => {
        room({
            type: 'join',
            payload: {id: roomId}
        });
    };

    const formatTime = (timeString: string) => {
        try {
            const date = new Date(timeString);
            return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        } catch {
            return t('unknown');
        }
    };

    return (
        <Paper elevation={3} style={{width: '100%', maxWidth: 400, margin: '0 auto', marginBottom: '100px'}}>
            <Box padding={2} borderBottom={`1px solid rgba(0,0,0,0.12)`}>
                <Box display="flex" justifyContent="space-between" alignItems="center" marginBottom={1}>
                    <Typography variant="h6">
                        {t('onlineRooms')} ({rooms.length})
                    </Typography>
                    <Tooltip title={t('refreshRoomList')}>
                        <IconButton onClick={refreshRooms} size="small">
                            <RefreshIcon fontSize="small" />
                        </IconButton>
                    </Tooltip>
                </Box>
                {loading && <LinearProgress />}
            </Box>

            <List style={{maxHeight: 350, overflow: 'auto', paddingBottom: 60}}>
                {rooms.length === 0 ? (
                    <ListItem>
                        <ListItemText
                            primary={t('noOnlineRooms')}
                            secondary={loading ? t('loading') : ''}
                        />
                    </ListItem>
                ) : (
                    rooms.map((roomInfo) => (
                        <ListItem key={roomInfo.id} divider>
                            <Box width="100%">
                                <Box display="flex" justifyContent="space-between" alignItems="center" marginBottom={1}>
                                    <Typography variant="subtitle1" fontWeight="bold">
                                        {roomInfo.id}
                                    </Typography>
                                    <Chip
                                        label={`${roomInfo.userCount} ${t('participants')}`}
                                        color="primary"
                                        size="small"
                                    />
                                </Box>
                                <Box display="flex" justifyContent="space-between" alignItems="center">
                                    <Typography variant="caption" color="textSecondary">
                                        {t('createdAt')}: {formatTime(roomInfo.createdAt)}
                                    </Typography>
                                    <Button
                                        variant="outlined"
                                        size="small"
                                        onClick={() => handleJoinRoom(roomInfo.id)}
                                    >
                                        {t('joinRoom')}
                                    </Button>
                                </Box>
                            </Box>
                        </ListItem>
                    ))
                )}
            </List>
        </Paper>
    );
};