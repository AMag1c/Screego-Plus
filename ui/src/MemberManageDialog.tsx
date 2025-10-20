import React from 'react';
import {
    Dialog,
    DialogTitle,
    DialogContent,
    List,
    ListItem,
    ListItemText,
    IconButton,
    Tooltip,
    Chip,
    Box,
    Button,
    Stack,
} from '@mui/material';
import StopIcon from '@mui/icons-material/Stop';
import BlockIcon from '@mui/icons-material/Block';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import PersonRemoveIcon from '@mui/icons-material/PersonRemove';
import CloseIcon from '@mui/icons-material/Close';
import {useTranslation} from 'react-i18next';
import {RoomUser} from './message';

interface MemberManageDialogProps {
    open: boolean;
    onClose: () => void;
    users: RoomUser[];
    onOwnerAction: (action: string, targetUserId?: string) => void;
}

export const MemberManageDialog: React.FC<MemberManageDialogProps> = ({
    open,
    onClose,
    users,
    onOwnerAction,
}) => {
    const {t} = useTranslation();

    // 找到当前用户
    const currentUser = users.find(u => u.you);
    const isOwner = currentUser?.owner ?? false;

    return (
        <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
            <DialogTitle>
                <Box display="flex" justifyContent="space-between" alignItems="center">
                    {isOwner ? t('manageUsers') : t('memberList')}
                    <IconButton onClick={onClose} size="small">
                        <CloseIcon />
                    </IconButton>
                </Box>
            </DialogTitle>
            <DialogContent>
                {/* 批量操作按钮 - 仅房主可见 */}
                {isOwner && (
                    <Stack direction="row" spacing={1} mb={2}>
                        <Button
                            variant="contained"
                            color="success"
                            size="small"
                            onClick={() => onOwnerAction('enable_all')}
                        >
                            {t('enableAllSharePermission')}
                        </Button>
                        <Button
                            variant="contained"
                            color="error"
                            size="small"
                            onClick={() => onOwnerAction('disable_all')}
                        >
                            {t('disableAllSharePermission')}
                        </Button>
                    </Stack>
                )}

                <List>
                    {users.map((user) => {
                        return (
                            <ListItem
                                key={user.id}
                                sx={{
                                    border: '1px solid #e0e0e0',
                                    borderRadius: 1,
                                    mb: 1,
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    alignItems: 'center',
                                }}
                            >
                                <ListItemText
                                    primary={
                                        <Box display="flex" alignItems="center" gap={1}>
                                            {user.name}
                                            {user.you && (
                                                <Chip
                                                    label={t('you')}
                                                    size="small"
                                                    color="info"
                                                />
                                            )}
                                            {user.owner && (
                                                <Chip
                                                    label={t('owner')}
                                                    size="small"
                                                    color="secondary"
                                                />
                                            )}
                                            {user.streaming && (
                                                <Chip
                                                    label={t('streaming')}
                                                    size="small"
                                                    color="primary"
                                                />
                                            )}
                                            {user.canShare === false && (
                                                <Chip
                                                    label={t('noSharePermission')}
                                                    size="small"
                                                    color="error"
                                                />
                                            )}
                                        </Box>
                                    }
                                />
                                {/* 管理按钮 - 仅房主可见，且不对自己显示 */}
                                {isOwner && !user.you && (
                                    <Box display="flex" gap={0.5}>
                                        {/* 停止投屏按钮 - 仅当用户正在投屏时显示 */}
                                        {user.streaming && (
                                            <Tooltip title={t('stopUserShare')} arrow>
                                                <IconButton
                                                    size="small"
                                                    color="warning"
                                                    onClick={() => onOwnerAction('stop_share', user.id)}
                                                >
                                                    <StopIcon />
                                                </IconButton>
                                            </Tooltip>
                                        )}

                                        {/* 切换投屏权限按钮 */}
                                        <Tooltip title={t('toggleSharePermission')} arrow>
                                            <IconButton
                                                size="small"
                                                color={user.canShare === false ? 'success' : 'error'}
                                                onClick={() =>
                                                    onOwnerAction('toggle_share_permission', user.id)
                                                }
                                            >
                                                {user.canShare === false ? (
                                                    <CheckCircleIcon />
                                                ) : (
                                                    <BlockIcon />
                                                )}
                                            </IconButton>
                                        </Tooltip>

                                        {/* 永久踢出用户按钮 */}
                                        <Tooltip title={t('banUser')} arrow>
                                            <IconButton
                                                size="small"
                                                color="error"
                                                onClick={() => onOwnerAction('ban', user.id)}
                                            >
                                                <BlockIcon />
                                            </IconButton>
                                        </Tooltip>

                                        {/* 临时踢出用户按钮 */}
                                        <Tooltip title={t('kickUser')} arrow>
                                            <IconButton
                                                size="small"
                                                color="warning"
                                                onClick={() => onOwnerAction('kick', user.id)}
                                            >
                                                <PersonRemoveIcon />
                                            </IconButton>
                                        </Tooltip>
                                    </Box>
                                )}
                            </ListItem>
                        );
                    })}
                </List>
            </DialogContent>
        </Dialog>
    );
};
