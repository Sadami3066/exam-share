import { io } from 'socket.io-client'

// 自动连接到当前服务器 (开发环境通过代理连接到 3000，生产环境连接到同源)
const socket = io()

export default socket
