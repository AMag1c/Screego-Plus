# 多阶段构建
FROM node:18-alpine AS builder

WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production

COPY . .
RUN npm run build

# 生产阶段 - 使用nginx提供前端文件
FROM nginx:alpine

# 复制构建的前端文件
COPY --from=builder /app/build /usr/share/nginx/html

# 复制nginx配置
COPY nginx.conf /etc/nginx/nginx.conf

EXPOSE 9100

CMD ["nginx", "-g", "daemon off;"]