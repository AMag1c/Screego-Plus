package ws

import (
	"bytes"

	"github.com/screego/server/ws/outgoing"
)

type Disconnected struct {
	Code   int
	Reason string
}

func (e *Disconnected) Execute(rooms *Rooms, current ClientInfo) error {
	e.executeNoError(rooms, current)
	return nil
}

func (e *Disconnected) executeNoError(rooms *Rooms, current ClientInfo) {
	roomID := rooms.connected[current.ID]
	delete(rooms.connected, current.ID)
	writeTimeout[outgoing.Message](current.Write, outgoing.CloseWriter{Code: e.Code, Reason: e.Reason})

	if roomID == "" {
		return
	}

	room, ok := rooms.Rooms[roomID]
	if !ok {
		// room may already be removed
		return
	}

	user, ok := room.Users[current.ID]

	if !ok {
		// room may already be removed
		return
	}

	delete(room.Users, current.ID)
	usersLeftTotal.Inc()

	for id, session := range room.Sessions {
		if bytes.Equal(session.Client.Bytes(), current.ID.Bytes()) {
			host, ok := room.Users[session.Host]
			if ok {
				host.WriteTimeout(outgoing.EndShare(id))
			}
			room.closeSession(rooms, id)
		}
		if bytes.Equal(session.Host.Bytes(), current.ID.Bytes()) {
			client, ok := room.Users[session.Client]
			if ok {
				client.WriteTimeout(outgoing.EndShare(id))
			}
			room.closeSession(rooms, id)
		}
	}

	// 如果房主离开
	if user.Owner {
		// 如果房间还有其他人，转移房主权限给下一个用户
		if len(room.Users) > 0 {
			// 找到下一个用户作为新房主
			for _, nextUser := range room.Users {
				nextUser.Owner = true
				break
			}
			room.notifyInfoChanged()
			return
		}
		// 如果房间没人了，关闭房间
		rooms.closeRoom(roomID)
		return
	}

	if len(room.Users) == 0 {
		rooms.closeRoom(roomID)
		return
	}

	room.notifyInfoChanged()
}
