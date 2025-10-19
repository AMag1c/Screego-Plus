import {useState, useEffect} from 'react';
import {RoomInfoSimple} from './message';
import {useSnackbar} from 'notistack';
import {useTranslation} from 'react-i18next';
import {urlWithSlash} from './url';

export const useRoomList = () => {
    const [rooms, setRooms] = useState<RoomInfoSimple[]>([]);
    const [loading, setLoading] = useState(false);
    const {enqueueSnackbar} = useSnackbar();
    const {t} = useTranslation();

    const fetchRooms = async () => {
        setLoading(true);
        try {
            // 从后端获取房间列表
            const response = await fetch(`${urlWithSlash}rooms`);
            if (response.ok) {
                const data = await response.json();
                setRooms(data);
            } else {
                console.log('No rooms API available or server error');
                setRooms([]);
            }
        } catch (error) {
            console.log('Failed to fetch room list:', error);
            // 如果API不存在或网络错误，显示空列表
            setRooms([]);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchRooms();

        // 每30秒刷新一次房间列表
        const interval = setInterval(fetchRooms, 30000);
        return () => clearInterval(interval);
    }, []);

    const refreshRooms = async () => {
        await fetchRooms();
        enqueueSnackbar(t('roomListRefreshed'), {variant: 'success'});
    };

    return {rooms, loading, refreshRooms};
};