import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { GuestMessage, UserMessageNotification } from '@/types'
import { storage } from '@/utils/storage'
import { generateId } from '@/utils/id'
import { globalTimeline } from '@/engine/Timeline'
import { useUserStore } from './user'

let _userStore: any = null

const getUserStore = () => {
  if (!_userStore) {
    _userStore = useUserStore()
  }
  return _userStore
}

export const useMessageStore = defineStore('message', () => {
  const messages = ref<GuestMessage[]>([])
  const notifications = ref<UserMessageNotification[]>([])

  function init() {
    messages.value = storage.getGuestMessages()
    notifications.value = storage.getMessageNotifications()
  }

  const messagesByCurrentWall = computed(() => {
    const userStore = getUserStore()
    const wallOwnerId = userStore.visitingUserId || userStore.currentUserId
    if (!wallOwnerId) return []
    
    const wallOwner = userStore.getUserById(wallOwnerId)
    const currentUserId = userStore.currentUserId
    const isOwner = currentUserId === wallOwnerId
    
    if (!isOwner && wallOwner && !wallOwner.isPublic) {
      return []
    }
    
    return messages.value
      .filter(m => m.wallOwnerId === wallOwnerId && !m.isDeleted)
      .sort((a, b) => b.createdAt - a.createdAt)
  })

  const unreadCount = computed(() => {
    const userStore = getUserStore()
    const userId = userStore.currentUserId
    if (!userId) return 0
    
    return messages.value.filter(
      m => m.wallOwnerId === userId && !m.isRead && !m.isDeleted
    ).length
  })

  const lastReadAtForCurrentUser = computed(() => {
    const userStore = getUserStore()
    const userId = userStore.currentUserId
    if (!userId) return 0
    const notif = notifications.value.find(n => n.userId === userId)
    return notif?.lastReadAt || 0
  })

  function addMessage(wallOwnerId: string, content: string, guestName: string): GuestMessage | null {
    const userStore = getUserStore()
    const wallOwner = userStore.getUserById(wallOwnerId)
    
    if (!wallOwner) return null
    
    const isOwner = userStore.currentUserId === wallOwnerId
    if (!isOwner && !wallOwner.isPublic) {
      console.warn('Cannot add message to private wall')
      return null
    }
    
    const now = globalTimeline.getTime()
    
    const message: GuestMessage = {
      id: generateId(),
      wallOwnerId,
      guestId: userStore.currentUserId,
      guestName: guestName || '匿名访客',
      content: content.trim(),
      createdAt: now,
      isRead: false,
      isDeleted: false
    }
    
    messages.value.push(message)
    storage.saveGuestMessages(messages.value)
    
    return message
  }

  function deleteMessage(messageId: string): void {
    const message = messages.value.find(m => m.id === messageId)
    if (!message) return
    
    const userStore = getUserStore()
    const userId = userStore.currentUserId
    
    if (message.wallOwnerId !== userId && message.guestId !== userId) {
      return
    }
    
    message.isDeleted = true
    storage.saveGuestMessages(messages.value)
  }

  function markAsRead(messageId: string): void {
    const message = messages.value.find(m => m.id === messageId)
    if (!message) return
    
    message.isRead = true
    storage.saveGuestMessages(messages.value)
  }

  function markAllAsRead(wallOwnerId: string): void {
    const now = globalTimeline.getTime()
    
    messages.value.forEach(m => {
      if (m.wallOwnerId === wallOwnerId && !m.isRead) {
        m.isRead = true
      }
    })
    storage.saveGuestMessages(messages.value)
    
    const notifIndex = notifications.value.findIndex(n => n.userId === wallOwnerId)
    if (notifIndex !== -1) {
      notifications.value[notifIndex].lastReadAt = now
    } else {
      notifications.value.push({
        userId: wallOwnerId,
        lastReadAt: now
      })
    }
    storage.saveMessageNotifications(notifications.value)
  }

  function getMessagesByWall(wallOwnerId: string): GuestMessage[] {
    const userStore = getUserStore()
    const wallOwner = userStore.getUserById(wallOwnerId)
    const currentUserId = userStore.currentUserId
    
    const isOwner = currentUserId === wallOwnerId
    if (!isOwner && wallOwner && !wallOwner.isPublic) {
      return []
    }
    
    return messages.value
      .filter(m => m.wallOwnerId === wallOwnerId && !m.isDeleted)
      .sort((a, b) => b.createdAt - a.createdAt)
  }

  function getUnreadMessages(wallOwnerId: string): GuestMessage[] {
    const userStore = getUserStore()
    const wallOwner = userStore.getUserById(wallOwnerId)
    const currentUserId = userStore.currentUserId
    
    const isOwner = currentUserId === wallOwnerId
    if (!isOwner && wallOwner && !wallOwner.isPublic) {
      return []
    }
    
    return messages.value.filter(
      m => m.wallOwnerId === wallOwnerId && !m.isRead && !m.isDeleted
    )
  }

  return {
    messages,
    notifications,
    messagesByCurrentWall,
    unreadCount,
    lastReadAtForCurrentUser,
    init,
    addMessage,
    deleteMessage,
    markAsRead,
    markAllAsRead,
    getMessagesByWall,
    getUnreadMessages
  }
})
