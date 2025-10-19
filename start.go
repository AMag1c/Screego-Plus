package main

import (
	"log"
	"net/http"
	"os/exec"
	"runtime"
	"time"
)

func main() {
	log.Println("=== Screego 统一启动器 ===")
	log.Println("正在启动前端和后端服务...")

	// 启动Go后端服务器
	go func() {
		log.Println("启动Go后端服务器在端口9100...")
		cmd := exec.Command("go", "run", "main.go", "serve")
		cmd.Stdout = log.Writer()
		cmd.Stderr = log.Writer()
		if err := cmd.Run(); err != nil {
			log.Printf("Go后端启动失败: %v", err)
		}
	}()

	// 等待Go服务器启动
	time.Sleep(3 * time.Second)

	// 启动前端开发服务器
	go func() {
		log.Println("启动前端开发服务器...")
		cmd := exec.Command("npm", "start")
		cmd.Dir = "ui"
		cmd.Stdout = log.Writer()
		cmd.Stderr = log.Writer()
		if err := cmd.Run(); err != nil {
			log.Printf("前端启动失败: %v", err)
		}
	}()

	// 等待前端服务器启动
	time.Sleep(5 * time.Second)

	// 打开浏览器
	openBrowser("http://localhost:9100")

	log.Println("🚀 Screego 已启动!")
	log.Println("🌐 访问地址: http://localhost:9100")
	log.Println("按 Ctrl+C 停止服务")

	// 保持程序运行
	select {}
}

func openBrowser(url string) {
	var err error

	switch runtime.GOOS {
	case "windows":
		err = exec.Command("rundll32", "url.dll,FileProtocolHandler", url).Start()
	case "darwin":
		err = exec.Command("open", url).Start()
	case "linux":
		err = exec.Command("xdg-open", url).Start()
	default:
		log.Printf("不支持的平台: %s", runtime.GOOS)
		return
	}

	if err != nil {
		log.Printf("无法打开浏览器: %v", err)
	}
}