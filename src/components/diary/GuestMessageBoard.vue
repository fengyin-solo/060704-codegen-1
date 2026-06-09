<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { useUserStore } from '@/stores/user'
import { useMessageStore } from '@/stores/message'
import { globalTimeline } from '@/engine/Timeline'

interface Props {
  wallOwnerId: string
  isOwner: boolean
  isWallPublic?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  isWallPublic: false
})

const userStore = useUserStore()
const messageStore = useMessageStore()

const newMessage = ref('')
const guestName = ref('')
const isSubmitting = ref(false)

const messages = computed(() => {
  return messageStore.getMessagesByWall(props.wallOwnerId)
})

const canDelete = (message: any) => {
  const userId = userStore.currentUserId
  return props.isOwner || message.guestId === userId
}

const displayName = computed(() => {
  if (userStore.currentUser) {
    return userStore.currentUser.name
  }
  return guestName.value || ''
})

function getTimeAgo(timestamp: number): string {
  const now = globalTimeline.getTime()
  const diff = now - timestamp
  
  if (diff < 1) return '刚刚'
  if (diff < 60) return `${Math.floor(diff)}秒前`
  if (diff < 3600) return `${Math.floor(diff / 60)}分钟前`
  if (diff < 86400) return `${Math.floor(diff / 3600)}小时前`
  return `${Math.floor(diff / 86400)}天前`
}

const canSubmit = computed(() => {
  if (props.isOwner) return true
  return props.isWallPublic
})

async function submitMessage() {
  const content = newMessage.value.trim()
  if (!content) return
  if (!canSubmit.value) {
    console.warn('Cannot submit message to private wall')
    return
  }
  
  const name = displayName.value.trim() || '匿名访客'
  
  isSubmitting.value = true
  try {
    const result = messageStore.addMessage(props.wallOwnerId, content, name)
    if (result) {
      newMessage.value = ''
    }
  } finally {
    isSubmitting.value = false
  }
}

function handleDelete(messageId: string) {
  if (confirm('确定要删除这条留言吗？')) {
    messageStore.deleteMessage(messageId)
  }
}

function handleMarkAllRead() {
  if (props.isOwner) {
    messageStore.markAllAsRead(props.wallOwnerId)
  }
}

watch(() => props.wallOwnerId, () => {
  if (props.isOwner && messageStore.unreadCount > 0) {
    setTimeout(() => handleMarkAllRead(), 1000)
  }
}, { immediate: true })
</script>

<template>
  <div class="space-y-4">
    <div class="flex items-center justify-between">
      <h2 class="font-vt323 text-2xl text-diary-rotting flex items-center gap-2">
        <span>📝</span>
        访客留言板
        <span v-if="isOwner && messageStore.unreadCount > 0" class="text-sm">
          ({{ messageStore.unreadCount }} 条新留言)
        </span>
      </h2>
      <button
        v-if="isOwner && messageStore.unreadCount > 0"
        class="text-sm text-diary-fresh font-vt323 hover:underline"
        @click="handleMarkAllRead"
      >
        全部已读
      </button>
    </div>
    
    <div class="ascii-divider text-gray-700">
      ============================================================
    </div>
    
    <div class="border-2 border-gray-700 rounded-lg p-4 bg-gray-900/50">
      <div v-if="!canSubmit && !isOwner" class="text-center py-4">
        <div class="text-3xl mb-2">🔒</div>
        <p class="text-gray-500 font-vt323">
          该主页为私密状态，暂不开放留言
        </p>
      </div>
      
      <div v-else class="mb-3">
        <input
          v-if="!userStore.currentUser"
          v-model="guestName"
          type="text"
          placeholder="你的名字（可选）"
          maxlength="20"
          class="w-full mb-2 px-3 py-2 bg-gray-800 border border-gray-700 rounded text-gray-200 font-vt323 placeholder-gray-500 focus:outline-none focus:border-diary-fresh"
        />
        <div v-else class="mb-2 text-gray-400 font-vt323 text-sm">
          以 <span class="text-diary-fresh">{{ userStore.currentUser.name }}</span> 的身份留言
        </div>
        <textarea
          v-model="newMessage"
          placeholder="来都来了，留句话再走吧~（最多200字）"
          maxlength="200"
          rows="3"
          class="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded text-gray-200 font-vt323 placeholder-gray-500 focus:outline-none focus:border-diary-fresh resize-none"
          :disabled="!canSubmit"
          :class="{ 'opacity-50 cursor-not-allowed': !canSubmit }"
          @keydown.enter.ctrl="submitMessage"
        />
        <div class="flex justify-between items-center mt-2">
          <span class="text-xs text-gray-500 font-vt323">
            {{ newMessage.length }}/200 | Ctrl+Enter 发送
          </span>
          <button
            class="btn-pixel text-diary-rotting border-diary-rotting text-sm"
            :disabled="!newMessage.trim() || isSubmitting || !canSubmit"
            :class="{ 'opacity-50 cursor-not-allowed': !newMessage.trim() || isSubmitting || !canSubmit }"
            @click="submitMessage"
          >
            {{ isSubmitting ? '发送中...' : '💌 留下脚印' }}
          </button>
        </div>
      </div>
    </div>
    
    <div class="space-y-3 max-h-96 overflow-y-auto">
      <div v-if="!canSubmit && !isOwner" class="text-center py-8">
        <div class="text-4xl mb-2">🔒</div>
        <p class="text-gray-500 font-vt323">
          该主页为私密状态，留言功能已关闭
        </p>
      </div>
      
      <div v-else-if="messages.length === 0" class="text-center py-8">
        <div class="text-4xl mb-2">🏜️</div>
        <p class="text-gray-500 font-vt323">
          还没有留言，成为第一个留下脚印的人吧~
        </p>
      </div>
      
      <div
        v-for="message in messages"
        :key="message.id"
        class="border border-gray-700 rounded-lg p-4 bg-gray-900/30 transition-all hover:border-gray-600"
        :class="{
          'border-diary-rotting/50 bg-diary-rotting/5': !message.isRead && isOwner
        }"
      >
        <div class="flex items-start justify-between mb-2">
          <div class="flex items-center gap-2">
            <span class="text-xl">👤</span>
            <div>
              <span class="font-vt323 text-diary-fresh">
                {{ message.guestName }}
              </span>
              <span
                v-if="!message.isRead && isOwner"
                class="ml-2 text-xs bg-diary-rotting text-white px-2 py-0.5 rounded font-vt323"
              >
                新
              </span>
            </div>
          </div>
          <div class="flex items-center gap-2">
            <span class="text-xs text-gray-500 font-vt323">
              {{ getTimeAgo(message.createdAt) }}
            </span>
            <button
              v-if="canDelete(message)"
              class="text-xs text-red-400 hover:text-red-300 font-vt323 transition-colors"
              @click="handleDelete(message.id)"
            >
              删除
            </button>
          </div>
        </div>
        <p class="text-gray-300 font-vt323 whitespace-pre-wrap break-words">
          {{ message.content }}
        </p>
      </div>
    </div>
  </div>
</template>
