package ws

import (
	"github.com/gorilla/websocket"
)

func init() {
	register("exit", func() Event {
		return &Exit{}
	})
}

type Exit struct{}

func (e *Exit) Execute(rooms *Rooms, current ClientInfo) error {
	// 触发断开连接事件，会自动处理房主转移
	disconnect := &Disconnected{
		Code:   websocket.CloseNormalClosure,
		Reason: "User Left",
	}
	disconnect.executeNoError(rooms, current)
	return nil
}
