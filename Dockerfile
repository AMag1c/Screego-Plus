# 多阶段构建 - 构建Go后端
FROM golang:1.23-alpine AS builder

WORKDIR /app

# 安装构建依赖
RUN apk add --no-cache git

# 复制go mod文件
COPY go.mod go.sum ./
RUN go mod download

# 复制源代码
COPY . .

# 创建假的ui/build目录和文件以满足embed要求
RUN mkdir -p ui/build && echo "placeholder" > ui/build/index.html

# 构建后端（静态编译）
RUN CGO_ENABLED=0 GOOS=linux go build -a -installsuffix cgo -o screego .

# 最终镜像
FROM alpine:latest

# 安装ca证书
RUN apk --no-cache add ca-certificates

WORKDIR /app

# 从构建阶段复制二进制文件
COPY --from=builder /app/screego .

# 创建非root用户
RUN adduser -D -u 1001 screego
USER screego

# 暴露端口
EXPOSE 9101
EXPOSE 3478/tcp
EXPOSE 3478/udp

# 启动命令
ENTRYPOINT ["./screego"]
CMD ["serve"]
