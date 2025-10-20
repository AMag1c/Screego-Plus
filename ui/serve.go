package ui

import (
	"embed"
	"io"
	"io/fs"
	"net/http"

	"github.com/gorilla/mux"
	"github.com/rs/zerolog/log"
)

//go:embed build/*
var buildFiles embed.FS

// Register registers the ui on the root path.
func Register(r *mux.Router) {
	// 尝试获取embed的文件系统
	files, err := fs.Sub(buildFiles, "build")
	if err != nil {
		log.Info().Msg("UI routes disabled (production mode with separate frontend container)")
		return
	}

	// 检查是否有实际内容（不只是placeholder）
	if entries, err := fs.ReadDir(files, "."); err == nil && len(entries) <= 1 {
		// 只有一个或零个文件，可能是placeholder
		log.Info().Msg("UI routes disabled (build directory is empty or placeholder)")
		return
	}

	r.Handle("/", serveFile(files, "index.html", "text/html"))
	r.Handle("/index.html", serveFile(files, "index.html", "text/html"))
	r.Handle("/assets/{resource}", http.FileServer(http.FS(files)))

	r.Handle("/favicon.ico", serveFile(files, "favicon.ico", "image/x-icon"))
	r.Handle("/logo.svg", serveFile(files, "logo.svg", "image/svg+xml"))
	r.Handle("/apple-touch-icon.png", serveFile(files, "apple-touch-icon.png", "image/png"))
	r.Handle("/og-banner.png", serveFile(files, "og-banner.png", "image/png"))
}

func serveFile(files fs.FS, name, contentType string) http.HandlerFunc {
	file, err := files.Open(name)
	if err != nil {
		log.Warn().Err(err).Msgf("could not find %s", name)
		return func(writer http.ResponseWriter, req *http.Request) {
			http.Error(writer, "Not Found", http.StatusNotFound)
		}
	}
	defer file.Close()
	content, err := io.ReadAll(file)
	if err != nil {
		log.Warn().Err(err).Msgf("could not read %s", name)
		return func(writer http.ResponseWriter, req *http.Request) {
			http.Error(writer, "Internal Server Error", http.StatusInternalServerError)
		}
	}

	return func(writer http.ResponseWriter, reg *http.Request) {
		writer.Header().Set("Content-Type", contentType)
		_, _ = writer.Write(content)
	}
}
