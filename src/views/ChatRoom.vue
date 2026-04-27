<script setup>
import { ref, onMounted, onUnmounted, nextTick } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { supabase } from '../supabase'

const router = useRouter()
const route = useRoute()
const messageInput = ref('')
const chatContainer = ref(null)
const fileInput = ref(null)
const isUploading = ref(false)
const showEmojiPicker = ref(false)

const commonEmojis = ['😀', '😂', '🥰', '😍', '😎', '😭', '😡', '👍', '❤️', '🔥', '🎉', '✨', '🎂', '🐶', '🚀', '🙏', '👏', '💪', '👀', '🎁']

const toggleEmojiPicker = () => {
  showEmojiPicker.value = !showEmojiPicker.value
}

const insertEmoji = (emoji) => {
  messageInput.value += emoji
  showEmojiPicker.value = false
}

// 로그인 시 저장된 정보 불러오기
const currentUser = localStorage.getItem('chat_username') || '익명'
const familyCode = localStorage.getItem('family_code') || 'kimfamily'

// 채팅 메시지 데이터 (Supabase에서 연동)
const messages = ref([])
// 현재 접속 중인 사용자 목록
const onlineUsers = ref([])

const roomTitle = ref('로딩 중...')

const updateLastRead = () => {
  const roomId = route.params.id || 1
  localStorage.setItem(`last_read_${roomId}`, new Date().toISOString())
}

const fetchRoomInfo = async () => {
  const roomId = route.params.id || 1
  const { data, error } = await supabase
    .from('rooms')
    .select('title')
    .eq('id', roomId)
    .single()
    
  if (data && !error) {
    roomTitle.value = data.title
  } else {
    roomTitle.value = '채팅방'
  }
}

const getAvatarEmoji = (name) => {
  if (!name) return '👤';
  if (name.includes('엄마')) return '👩';
  if (name.includes('아빠')) return '👨';
  if (name.includes('할머니')) return '👵';
  if (name.includes('할아버지')) return '👴';
  if (name.includes('누나') || name.includes('언니')) return '👩‍🦰';
  if (name.includes('형') || name.includes('오빠')) return '👨‍🦱';
  if (name.includes('동생')) return '👶';
  
  // 그 외의 이름은 무작위 동물 이모티콘 부여 (이름에 따라 고정됨)
  const emojis = ['🐶', '🐱', '🐰', '🦊', '🐻', '🐼', '🐨', '🐯', '🦁', '🐮'];
  let sum = 0;
  for (let i = 0; i < name.length; i++) sum += name.charCodeAt(i);
  return emojis[sum % emojis.length];
}

const goBack = () => {
  router.push('/chats')
}

const scrollToBottom = () => {
  nextTick(() => {
    if (chatContainer.value) {
      chatContainer.value.scrollTop = chatContainer.value.scrollHeight
      // 모바일 키보드 애니메이션이나 DOM 렌더링 지연을 고려해 0.1초 후 한번 더 스크롤
      setTimeout(() => {
        if (chatContainer.value) {
          chatContainer.value.scrollTop = chatContainer.value.scrollHeight
        }
      }, 100)
    }
  })
}

const fetchMessages = async () => {
  const roomId = route.params.id || 1
  const { data, error } = await supabase
    .from('messages')
    .select('*')
    .eq('room_id', roomId)
    .eq('family_code', familyCode)
    .eq('family_code', familyCode)
    .order('created_at', { ascending: true })
    
  if (error) {
    console.error('Error fetching messages:', error)
  } else if (data) {
    messages.value = data
    scrollToBottom()
  }
}

const triggerFileInput = () => {
  if (fileInput.value) {
    fileInput.value.click()
  }
}

const handleFileUpload = async (event) => {
  const file = event.target.files[0]
  if (!file) return

  try {
    isUploading.value = true
    const fileExt = file.name.split('.').pop()
    const fileName = `${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`
    
    // Storage에 업로드
    const { data, error } = await supabase.storage
      .from('chat-images')
      .upload(fileName, file)

    if (error) throw error

    // Public URL 가져오기
    const { data: { publicUrl } } = supabase.storage
      .from('chat-images')
      .getPublicUrl(fileName)

    // 빈 텍스트와 함께 이미지 URL 전송
    await sendMessage('', publicUrl)
  } catch (error) {
    console.error('업로드 실패:', error)
    alert('이미지 업로드에 실패했습니다. Storage 설정이나 정책을 확인하세요.')
  } finally {
    isUploading.value = false
    event.target.value = '' // input 초기화
  }
}

const downloadImage = async (url) => {
  try {
    const response = await fetch(url)
    const blob = await response.blob()
    const blobUrl = window.URL.createObjectURL(blob)
    
    const a = document.createElement('a')
    a.style.display = 'none'
    a.href = blobUrl
    const fileName = url.split('/').pop().split('?')[0] || `image_${Date.now()}`
    a.download = fileName
    
    document.body.appendChild(a)
    a.click()
    
    document.body.removeChild(a)
    window.URL.revokeObjectURL(blobUrl)
  } catch (error) {
    console.error('다운로드 실패:', error)
    // 보안 정책(CORS) 등으로 인해 직접 다운로드가 막힌 경우 새 창으로 열기 (대체 수단)
    window.open(url, '_blank')
  }
}

const sendMessage = async (textOverride = null, imageUrl = null) => {
  const textToSend = textOverride !== null ? textOverride : messageInput.value
  if (!textToSend.trim() && !imageUrl) return
  
  const now = new Date()
  const hours = now.getHours()
  const minutes = now.getMinutes()
  const ampm = hours >= 12 ? '오후' : '오전'
  const formattedTime = `${ampm} ${hours % 12 || 12}:${minutes < 10 ? '0'+minutes : minutes}`

  const roomId = route.params.id || 1

  const newMessage = {
    room_id: roomId,
    sender: currentUser,
    text: textToSend,
    time: formattedTime,
    image_url: imageUrl,
    family_code: familyCode
  }

  // 1. 화면에 즉시 표시 (Optimistic UI Update)
  const tempId = Date.now()
  messages.value.push({ ...newMessage, id: tempId })
  
  if (textOverride === null) {
    messageInput.value = ''
  }
  scrollToBottom()

  // 2. 백그라운드에서 DB에 메시지 저장
  const { data, error } = await supabase
    .from('messages')
    .insert([newMessage])
    .select()

  if (error) {
    console.error('Error sending message:', error)
    // 전송 실패 시 방금 추가한 메시지 제거
    messages.value = messages.value.filter(m => m.id !== tempId)
    alert('메시지 전송에 실패했습니다.')
    return
  }

  // 3. 실제 DB에 저장된 후 정확한 ID로 업데이트
  if (data && data.length > 0) {
    const index = messages.value.findIndex(m => m.id === tempId)
    if (index !== -1) {
      messages.value[index] = data[0]
    }
  }
}

// 채널 연결 객체를 저장할 변수 (컴포넌트 언마운트 시 정리용)
let roomChannel = null

onMounted(() => {
  updateLastRead()
  fetchRoomInfo()
  fetchMessages()
  
  // 실시간(Realtime) 메시지 및 접속자(Presence) 구독
  const roomId = route.params.id || 1
  roomChannel = supabase.channel(`room_${roomId}`, {
    config: {
      presence: { key: currentUser },
    },
  })

  roomChannel
    .on('presence', { event: 'sync' }, () => {
      const newState = roomChannel.presenceState()
      const users = []
      for (const key in newState) {
        // 동일 기기에서 여러 번 연결되는 경우를 대비해 첫 번째 데이터만 사용
        users.push(newState[key][0].username)
      }
      onlineUsers.value = [...new Set(users)]
    })
    .on('postgres_changes', { 
      event: 'INSERT', 
      schema: 'public', 
      table: 'messages',
      filter: `room_id=eq.${roomId}`
    }, (payload) => {
      console.log('새 메시지 수신됨 (Realtime):', payload)
      const exists = messages.value.find(m => m.id === payload.new.id)
      if (!exists) {
        messages.value.push(payload.new)
        scrollToBottom()
        updateLastRead() // 방을 보고 있는 동안에는 계속 읽음 처리
      }
    })
    .subscribe(async (status) => {
      console.log('Realtime 구독 상태:', status)
      if (status === 'SUBSCRIBED') {
        console.log('✅ 실시간 채팅 및 Presence 연결 완료!')
        await roomChannel.track({
          username: currentUser
        })
      }
    })
})

// 컴포넌트가 파괴될 때(뒤로가기 등) 구독 해제 및 마지막으로 한 번 더 시간 기록
onUnmounted(() => {
  updateLastRead()
  if (roomChannel) {
    supabase.removeChannel(roomChannel)
  }
})
</script>

<template>
  <div class="chat-room-view flex-col">
    <header class="app-header">
      <button class="icon-btn" @click="goBack">⬅️</button>
      <div class="header-center">
        <h1 class="header-title font-bold">{{ roomTitle }}</h1>
        <div class="online-users" v-if="onlineUsers.length > 0">
          🟢 {{ onlineUsers.length }}명 접속 중 ({{ onlineUsers.join(', ') }})
        </div>
      </div>
      <button class="icon-btn">🔍</button>
    </header>

    <div class="chat-messages" ref="chatContainer">
      <div 
        v-for="msg in messages" 
        :key="msg.id" 
        class="message-wrapper animate-slide-up"
        :class="{ 'my-message': msg.sender === currentUser }"
      >
        <div v-if="msg.sender !== currentUser" class="sender-name">
          {{ getAvatarEmoji(msg.sender) }} {{ msg.sender }}
        </div>
        <div class="message-row">
          <div class="message-bubble" :class="{ 'has-image': msg.image_url }">
            <img 
              v-if="msg.image_url" 
              :src="msg.image_url" 
              class="message-image" 
              alt="첨부 이미지" 
              @click="downloadImage(msg.image_url)"
              title="클릭하여 다운로드"
            />
            <div v-if="msg.text" class="message-text">{{ msg.text }}</div>
          </div>
          <span class="message-time text-secondary">{{ msg.time }}</span>
        </div>
      </div>
    </div>

    <!-- 이모티콘 피커 -->
    <div v-if="showEmojiPicker" class="emoji-picker animate-slide-up">
      <button 
        v-for="emoji in commonEmojis" 
        :key="emoji" 
        @click="insertEmoji(emoji)" 
        class="emoji-btn"
      >
        {{ emoji }}
      </button>
    </div>

    <div class="chat-input-area">
      <button class="icon-btn" @click="toggleEmojiPicker" :disabled="isUploading">😀</button>
      <input type="file" ref="fileInput" accept="image/*" style="display: none" @change="handleFileUpload" />
      <button class="icon-btn" @click="triggerFileInput" :disabled="isUploading">
        {{ isUploading ? '⏳' : '📎' }}
      </button>
      <input 
        type="text" 
        v-model="messageInput" 
        @keyup.enter="() => sendMessage()"
        :placeholder="isUploading ? '업로드 중...' : '메시지를 입력하세요'" 
        class="message-input"
        :disabled="isUploading"
      />
      <button 
        class="send-btn" 
        :class="{ 'active': messageInput.trim().length > 0 }"
        @click="() => sendMessage()"
        :disabled="isUploading"
      >
        전송
      </button>
    </div>
  </div>
</template>

<style scoped>
.chat-room-view {
  position: relative;
  display: flex;
  flex-direction: column;
  height: 100vh;
  height: 100dvh; /* 모바일 브라우저 주소창 고려 */
  background-color: var(--color-background);
}

.app-header {
  height: var(--header-height);
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 16px;
  background-color: var(--color-surface);
  box-shadow: var(--shadow-sm);
  z-index: 10;
}

.header-center {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
}

.header-title {
  font-size: 1.1rem;
  text-align: center;
}

.online-users {
  font-size: 0.75rem;
  color: #4CAF50;
  margin-top: 2px;
}

.icon-btn {
  background: none;
  border: none;
  font-size: 1.2rem;
  padding: 6px;
  cursor: pointer;
  flex-shrink: 0;
}

.chat-messages {
  flex: 1;
  overflow-y: auto;
  padding: 20px 16px;
  padding-bottom: 40px; /* 키보드가 내려갈 때를 대비한 넉넉한 여백 */
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.message-wrapper {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  max-width: 80%;
}

.my-message {
  align-self: flex-end;
  align-items: flex-end;
}

.sender-name {
  font-size: 0.8rem;
  color: var(--color-text-secondary);
  margin-bottom: 4px;
  margin-left: 4px;
}

.message-row {
  display: flex;
  align-items: flex-end;
  gap: 6px;
}

.my-message .message-row {
  flex-direction: row-reverse;
}

.message-bubble {
  padding: 10px 14px;
  border-radius: var(--radius-md);
  font-size: 0.95rem;
  line-height: 1.4;
  word-break: break-word;
  background-color: var(--color-surface);
  color: var(--color-text);
  box-shadow: 0 1px 2px rgba(0,0,0,0.05);
}

.message-bubble.has-image {
  padding: 4px;
  background-color: transparent;
  box-shadow: none;
}

.my-message .message-bubble.has-image {
  background-color: transparent;
}

.message-image {
  max-width: 240px;
  max-height: 300px;
  border-radius: 12px;
  object-fit: cover;
  display: block;
  cursor: pointer;
  transition: opacity 0.2s;
}

.message-image:active,
.message-image:hover {
  opacity: 0.85;
}

.message-bubble.has-image .message-text {
  padding: 8px 10px;
  background-color: var(--color-surface);
  border-radius: var(--radius-sm);
  margin-top: 4px;
  color: var(--color-text);
  box-shadow: 0 1px 2px rgba(0,0,0,0.05);
}

.my-message .message-bubble.has-image .message-text {
  background-color: var(--color-message-sent);
  color: var(--color-message-sent-text);
}

/* 타인 말풍선 꼬리표 (선택사항) */
.message-wrapper:not(.my-message) .message-bubble {
  border-top-left-radius: 4px;
}

.my-message .message-bubble {
  background-color: var(--color-message-sent);
  color: var(--color-message-sent-text);
  border-top-right-radius: 4px;
}

.message-time {
  font-size: 0.7rem;
  white-space: nowrap;
}

.chat-input-area {
  display: flex;
  align-items: center;
  padding: 10px 12px;
  background-color: var(--color-surface);
  border-top: 1px solid var(--color-surface-elevated);
  gap: 8px;
  padding-bottom: calc(10px + env(safe-area-inset-bottom));
}

.message-input {
  flex: 1;
  min-width: 0;
  padding: 10px 14px;
  border: none;
  border-radius: var(--radius-full);
  background-color: var(--color-background);
  font-size: 0.95rem;
  outline: none;
  font-family: inherit;
}

.send-btn {
  background-color: #E0E0E0;
  color: white;
  border: none;
  border-radius: var(--radius-full);
  padding: 8px 16px;
  font-size: 0.9rem;
  font-weight: 600;
  flex-shrink: 0;
  white-space: nowrap;
  transition: all 0.2s;
}

.send-btn.active {
  background-color: var(--color-primary);
  cursor: pointer;
}

.emoji-picker {
  position: absolute;
  bottom: calc(70px + env(safe-area-inset-bottom));
  left: 16px;
  right: 16px;
  background-color: var(--color-surface);
  border-radius: var(--radius-md);
  padding: 12px;
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(36px, 1fr));
  gap: 8px;
  box-shadow: var(--shadow-lg);
  z-index: 20;
  border: 1px solid var(--color-surface-elevated);
}

.emoji-btn {
  background: none;
  border: none;
  font-size: 1.5rem;
  cursor: pointer;
  padding: 4px;
  border-radius: var(--radius-sm);
  transition: background-color 0.2s;
  display: flex;
  align-items: center;
  justify-content: center;
}

.emoji-btn:active {
  background-color: var(--color-surface-elevated);
}
</style>
