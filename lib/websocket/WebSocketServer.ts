import { Server } from 'http'
import { WebSocket, WebSocketServer as WSServer } from 'ws'
import { NotificationManager } from '../notifications/NotificationManager'
import { verifyToken } from '../auth/jwt'

export class WebSocketServer {
  private wss: WSServer
  private notificationManager: NotificationManager

  constructor(server: Server, notificationManager: NotificationManager) {
    this.wss = new WSServer({ server })
    this.notificationManager = notificationManager
    this.initialize()
  }

  private initialize(): void {
    this.wss.on('connection', async (ws: WebSocket, req) => {
      try {
        // Extract token from query string
        const url = new URL(req.url!, `http://${req.headers.host}`)
        const token = url.searchParams.get('token')
        
        if (!token) {
          ws.close(1008, 'Token required')
          return
        }

        // Verify token and get user
        const user = await verifyToken(token)
        if (!user) {
          ws.close(1008, 'Invalid token')
          return
        }

        // Register client for notifications
        this.notificationManager.registerWebSocketClient(user.id, ws)

        // Handle incoming messages
        ws.on('message', (message: string) => {
          this.handleMessage(user.id, message, ws)
        })

        // Handle client disconnect
        ws.on('close', () => {
          console.log(`Client ${user.id} disconnected`)
        })

      } catch (error) {
        console.error('WebSocket connection error:', error)
        ws.close(1011, 'Internal server error')
      }
    })
  }

  private handleMessage(userId: string, message: string, ws: WebSocket): void {
    try {
      const data = JSON.parse(message)
      
      switch (data.type) {
        case 'ping':
          ws.send(JSON.stringify({ type: 'pong' }))
          break
          
        case 'subscribe':
          // Handle subscription to specific notification types
          break
          
        default:
          console.warn(`Unknown message type: ${data.type}`)
      }
    } catch (error) {
      console.error('Error handling WebSocket message:', error)
    }
  }
} 