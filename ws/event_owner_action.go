package ws

import (
	"fmt"

	"github.com/gorilla/websocket"
	"github.com/rs/xid"
	"github.com/screego/server/ws/outgoing"
)

func init() {
	register("owneraction", func() Event {
		return &OwnerAction{}
	})
}

type OwnerAction struct {
	Action       string `json:"action"`       // "stop_share", "toggle_share_permission", "kick", "ban", "enable_all", "disable_all"
	TargetUserID string `json:"targetUserId"` // 目标用户ID
}

func (e *OwnerAction) Execute(rooms *Rooms, current ClientInfo) error {
	room, err := rooms.CurrentRoom(current)
	if err != nil {
		return err
	}

	// 检查是否是房主
	currentUser := room.Users[current.ID]
	if currentUser == nil || !currentUser.Owner {
		return fmt.Errorf("only owner can perform this action")
	}

	// 批量操作
	if e.Action == "enable_all" {
		// 启用所有用户的投屏权限
		for _, user := range room.Users {
			if user.ID.Compare(current.ID) != 0 { // 不包括房主自己
				user.CanShare = true
			}
		}
		room.notifyInfoChanged()
		return nil
	}

	if e.Action == "disable_all" {
		// 禁用所有用户的投屏权限，并停止正在投屏的用户
		for id, user := range room.Users {
			if user.ID.Compare(current.ID) != 0 { // 不包括房主自己
				user.CanShare = false
				if user.Streaming {
					user.Streaming = false
					for sessionID, session := range room.Sessions {
						if session.Host.Compare(id) == 0 {
							room.closeSession(rooms, sessionID)
						}
					}
				}
			}
		}
		room.notifyInfoChanged()
		return nil
	}

	// 单个用户操作需要 targetUserId
	if e.TargetUserID == "" {
		return fmt.Errorf("targetUserId is required for individual actions")
	}

	// 解析目标用户ID
	targetID, err := xid.FromString(e.TargetUserID)
	if err != nil {
		return fmt.Errorf("invalid user ID")
	}

	targetUser, ok := room.Users[targetID]
	if !ok {
		return fmt.Errorf("user not found")
	}

	// 不能对自己操作
	if targetID.Compare(current.ID) == 0 {
		return fmt.Errorf("cannot perform action on yourself")
	}

	switch e.Action {
	case "stop_share":
		// 停止目标用户的投屏
		if targetUser.Streaming {
			targetUser.Streaming = false
			// 关闭该用户的所有会话
			for id, session := range room.Sessions {
				if session.Host.Compare(targetID) == 0 {
					room.closeSession(rooms, id)
				}
			}
			room.notifyInfoChanged()
		}
		return nil

	case "toggle_share_permission":
		// 切换目标用户的投屏权限
		targetUser.CanShare = !targetUser.CanShare
		// 如果禁用权限且用户正在投屏，停止投屏
		if !targetUser.CanShare && targetUser.Streaming {
			targetUser.Streaming = false
			for id, session := range room.Sessions {
				if session.Host.Compare(targetID) == 0 {
					room.closeSession(rooms, id)
				}
			}
		}
		room.notifyInfoChanged()
		return nil

	case "kick":
		// 临时踢出用户（可以重新加入）
		delete(rooms.connected, targetID)
		delete(room.Users, targetID)

		// 关闭该用户的所有会话
		for id, session := range room.Sessions {
			if session.Host.Compare(targetID) == 0 || session.Client.Compare(targetID) == 0 {
				room.closeSession(rooms, id)
			}
		}

		// 通知被踢出的用户
		targetUser.WriteTimeout(outgoing.CloseWriter{
			Code:   websocket.CloseNormalClosure,
			Reason: "kickedByOwner",
		})

		room.notifyInfoChanged()
		usersLeftTotal.Inc()
		return nil

	case "ban":
		// 永久踢出用户（加入黑名单，无法再次加入）
		// 添加到IP黑名单
		targetIP := targetUser.Addr.String()
		room.BannedIPs[targetIP] = true

		delete(rooms.connected, targetID)
		delete(room.Users, targetID)

		// 关闭该用户的所有会话
		for id, session := range room.Sessions {
			if session.Host.Compare(targetID) == 0 || session.Client.Compare(targetID) == 0 {
				room.closeSession(rooms, id)
			}
		}

		// 通知被永久踢出的用户
		targetUser.WriteTimeout(outgoing.CloseWriter{
			Code:   websocket.CloseNormalClosure,
			Reason: "bannedByOwner",
		})

		room.notifyInfoChanged()
		usersLeftTotal.Inc()
		return nil

	default:
		return fmt.Errorf("unknown action: %s", e.Action)
	}
}
