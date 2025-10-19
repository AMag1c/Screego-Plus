# Screego 部署指南

这个指南将帮助你在Linux服务器上部署Screego屏幕共享服务，并配置Nginx反向代理和SSL证书。

## 📋 前置要求

- Linux服务器（Ubuntu 20.04+ 或 CentOS 8+）
- Docker和Docker Compose已安装
- 域名（可选，用于SSL证书配置）
- 服务器公网IP地址

## 🚀 快速部署

### 1. 克隆或下载项目文件

```bash
# 如果从git仓库克隆
git clone <repository-url>
cd screego

# 或者直接下载项目文件到服务器
```

### 2. 修改配置文件

```bash
# 复制示例配置文件
cp screego.config.example screego.config

# 编辑配置文件，修改以下关键配置：
nano screego.config
```

**重要配置项：**
- `SCREEGO_EXTERNAL_IP`: 设置为你的服务器公网IP
- `SCREEGO_AUTH_MODE`: 认证模式（none/turn/all）
- `SCREEGO_TURN_PORT_RANGE`: TURN端口范围（如50000:60000）

### 3. 使用部署脚本

```bash
# 给脚本执行权限
chmod +x deploy.sh

# 运行部署脚本
./deploy.sh
```

### 4. 验证部署

部署完成后，访问: `http://你的服务器IP:9100`

## 🔐 配置SSL证书和域名

如果你有域名，可以配置Nginx反向代理和SSL证书：

### 1. 准备工作

确保：
- 域名已解析到服务器IP
- 服务器防火墙已开放80、443端口

### 2. 使用SSL配置脚本

```bash
# 给脚本执行权限
chmod +x setup-ssl.sh

# 编辑脚本，修改域名和邮箱
nano setup-ssl.sh

# 运行SSL配置脚本
sudo ./setup-ssl.sh
```

### 3. 手动配置（可选）

如果自动脚本不工作，可以手动配置：

```bash
# 1. 安装nginx和certbot
sudo apt update
sudo apt install -y nginx certbot python3-certbot-nginx

# 2. 修改nginx配置文件
sudo nano nginx-screego.conf  # 修改域名
sudo cp nginx-screego.conf /etc/nginx/sites-available/screego
sudo ln -s /etc/nginx/sites-available/screego /etc/nginx/sites-enabled/
sudo rm /etc/nginx/sites-enabled/default

# 3. 测试nginx配置
sudo nginx -t

# 4. 获取SSL证书
sudo certbot --nginx -d your-domain.com --email admin@your-domain.com --agree-tos --non-interactive

# 5. 重启nginx
sudo systemctl restart nginx
```

## 🔧 防火墙配置

确保以下端口已开放：

```bash
# 如果使用ufw
sudo ufw allow 9100/tcp    # Screego Web界面
sudo ufw allow 3478/tcp    # TURN服务器
sudo ufw allow 3478/udp    # TURN服务器UDP
sudo ufw allow 50000:60000/udp  # TURN端口范围
sudo ufw allow 80/tcp      # HTTP
sudo ufw allow 443/tcp     # HTTPS

# 如果使用iptables
sudo iptables -A INPUT -p tcp --dport 9100 -j ACCEPT
sudo iptables -A INPUT -p tcp --dport 3478 -j ACCEPT
sudo iptables -A INPUT -p udp --dport 3478 -j ACCEPT
sudo iptables -A INPUT -p udp --dport 50000:60000 -j ACCEPT
sudo iptables -A INPUT -p tcp --dport 80 -j ACCEPT
sudo iptables -A INPUT -p tcp --dport 443 -j ACCEPT
```

## 📊 服务管理

```bash
# 查看服务状态
docker-compose ps

# 查看日志
docker-compose logs -f

# 停止服务
docker-compose down

# 重启服务
docker-compose restart

# 更新服务
docker-compose pull
docker-compose up -d
```

## 🛠️ 故障排除

### 1. 无法访问Web界面

```bash
# 检查服务状态
docker-compose ps

# 查看日志
docker-compose logs

# 检查端口是否被占用
sudo netstat -tlnp | grep 9100

# 检查防火墙
sudo ufw status
```

### 2. 屏幕共享连接失败

```bash
# 检查TURN服务器端口
sudo netstat -tlnp | grep 3478

# 检查UDP端口范围
sudo netstat -ulnp | grep 50000

# 检查外部IP配置
grep SCREEGO_EXTERNAL_IP screego.config
```

### 3. SSL证书问题

```bash
# 检查证书状态
sudo certbot certificates

# 测试nginx配置
sudo nginx -t

# 查看nginx错误日志
sudo tail -f /var/log/nginx/error.log
```

## 📝 配置说明

### 认证模式说明

- `none`: 无需认证，任何人都可以创建和加入房间
- `turn`: 仅需要TURN服务器认证
- `all`: 需要完整认证（推荐用于生产环境）

### TURN服务器说明

TURN服务器用于NAT穿透，是屏幕共享功能的核心组件。

- TCP端口3478：用于信令
- UDP端口3478：用于媒体传输
- UDP端口范围50000-60000：用于媒体传输

### 环境变量说明

完整的配置选项请参考 `screego.config.example` 文件。

## 📞 支持

如遇问题，请：

1. 检查日志文件
2. 验证防火墙配置
3. 确认域名解析（如果使用域名）
4. 查看项目GitHub Issues

---

**注意**: 部署完成后，建议定期备份配置文件和检查服务状态。