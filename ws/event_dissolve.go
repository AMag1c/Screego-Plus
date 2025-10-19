package ws

import (
	"fmt"

	"github.com/gorilla/websocket"
	"github.com/screego/server/ws/outgoing"
)

func init() {
	register("dissolve", func() Event {
		return &Dissolve{}
	})
}

type Dissolve struct{}

func (e *Dissolve) Execute(rooms *Rooms, current ClientInfo) error {
	roomID := rooms.connected[current.ID]
	if roomID == "" {
		return fmt.Errorf("you are not in a room")
	}

	room, ok := rooms.Rooms[roomID]
	if !ok {
		return fmt.Errorf("room does not exist")
	}

	user, ok := room.Users[current.ID]
	if !ok {
		return fmt.Errorf("you are not in this room")
	}

	// 只有房主可以解散房间
	if !user.Owner {
		return fmt.Errorf("only the room owner can dissolve the room")
	}

	// 通知所有成员房间被解散
	for _, member := range room.Users {
		delete(rooms.connected, member.ID)
		member.WriteTimeout(outgoing.CloseWriter{
			Code:   websocket.CloseNormalClosure,
			Reason: "Room Dissolved",
		})
	}

	// 关闭房间
	rooms.closeRoom(roomID)

	return nil
}
