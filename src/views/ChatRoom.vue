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
const totalFamilyMembers = ref(1)

// 투표 관련 상태
const showPollModal = ref(false)
const pollQuestion = ref('')
const pollOptions = ref([{ text: '' }, { text: '' }])

const togglePollModal = () => {
  showPollModal.value = !showPollModal.value
  if (showPollModal.value) {
    pollQuestion.value = ''
    pollOptions.value = [{ text: '' }, { text: '' }]
  }
}

const addPollOption = () => {
  pollOptions.value.push({ text: '' })
}

const createPoll = async () => {
  if (!pollQuestion.value.trim() || pollOptions.value.filter(o => o.text.trim()).length < 2) {
    alert('질문과 최소 2개의 항목을 입력하세요.')
    return
  }
  
  const pollData = {
    question: pollQuestion.value.trim(),
    options: pollOptions.value.filter(o => o.text.trim()).map((o, i) => ({ id: i, text: o.text.trim(), votes: [] }))
  }
  
  await sendMessage('', null, 'poll', pollData)
  togglePollModal()
}

const votePoll = async (msgId, optionId) => {
  const msg = messages.value.find(m => m.id === msgId)
  if (!msg || msg.type !== 'poll') return
  
  // 상태 복사
  const newPollData = JSON.parse(JSON.stringify(msg.poll_data))
  
  // 기존 투표 제거 (1인 1표)
  newPollData.options.forEach(opt => {
    opt.votes = opt.votes.filter(v => v !== currentUser)
  })
  
  // 새 투표 추가
  const selectedOpt = newPollData.options.find(o => o.id === optionId)
  if (selectedOpt) {
    selectedOpt.votes.push(currentUser)
  }
  
  // 화면 즉시 반영 및 DB 업데이트
  msg.poll_data = newPollData
  await supabase.from('messages').update({ poll_data: newPollData }).eq('id', msgId)
}

const getPollPercentage = (pollData, opt) => {
  const totalVotes = pollData.options.reduce((sum, o) => sum + o.votes.length, 0)
  if (totalVotes === 0) return 0
  return Math.round((opt.votes.length / totalVotes) * 100)
}

const fetchTotalFamilyMembers = async () => {
  const { count } = await supabase.from('family_members').select('*', { count: 'exact' }).eq('family_code', familyCode)
  totalFamilyMembers.value = count || 1
}

const updateLastRead = () => {
  const roomId = route.params.id || 1
  localStorage.setItem(`last_read_${roomId}`, new Date().toISOString())
}

const markMessagesAsRead = async (msgs) => {
  // 내가 보낸 것이 아니고, 아직 내가 안 읽은 메시지만 찾음
  const unreadMsgs = msgs.filter(m => m.user !== currentUser && m.sender !== currentUser && !(m.read_by || '').includes(currentUser))
  if (unreadMsgs.length === 0) return

  for (const msg of unreadMsgs) {
    const newReadBy = msg.read_by ? msg.read_by + ',' + currentUser : currentUser;
    msg.read_by = newReadBy // 화면 즉시 업데이트
    
    // DB 업데이트 (await 안하고 백그라운드로 쏨)
    supabase.from('messages').update({ read_by: newReadBy }).eq('id', msg.id).then()
  }
}

const getUnreadCount = (msg) => {
  const readList = (msg.read_by || '').split(',').filter(Boolean)
  const count = totalFamilyMembers.value - 1 - readList.length
  return Math.max(0, count)
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
    .order('created_at', { ascending: true })
    
  if (error) {
    console.error('Error fetching messages:', error)
  } else if (data) {
    messages.value = data
    markMessagesAsRead(messages.value)
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
    
    const { data, error } = await supabase.storage
      .from('chat-images')
      .upload(fileName, file)

    if (error) throw error

    const { data: { publicUrl } } = supabase.storage
      .from('chat-images')
      .getPublicUrl(fileName)

    await sendMessage('', publicUrl)
  } catch (error) {
    console.error('업로드 실패:', error)
    alert('이미지 업로드에 실패했습니다.')
  } finally {
    isUploading.value = false
    event.target.value = ''
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
    window.open(url, '_blank')
  }
}

const sendMessage = async (textOverride = null, imageUrl = null, type = 'text', pollData = null) => {
  const textToSend = textOverride !== null ? textOverride : messageInput.value
  if (!textToSend.trim() && !imageUrl && type !== 'poll') return
  
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
    family_code: familyCode,
    type: type,
    poll_data: pollData,
    read_by: ''
  }

  // 1. 화면에 즉시 표시 (Optimistic UI Update)
  const tempId = Date.now()
  messages.value.push({ ...newMessage, id: tempId })
  
  if (textOverride === null && type !== 'poll') {
    messageInput.value = ''
  }
  scrollToBottom()

  // 2. DB에 저장
  const { data, error } = await supabase
    .from('messages')
    .insert([newMessage])
    .select()

  if (error) {
    console.error('Error sending message:', error)
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

let roomChannel = null

onMounted(() => {
  updateLastRead()
  fetchRoomInfo()
  fetchTotalFamilyMembers()
  fetchMessages()
  
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
      const exists = messages.value.find(m => m.id === payload.new.id)
      if (!exists) {
        // 내가 보고 있는 방에 새 메시지가 왔으면 즉시 읽음 처리
        if (payload.new.sender !== currentUser && payload.new.user !== currentUser) {
          payload.new.read_by = payload.new.read_by ? payload.new.read_by + ',' + currentUser : currentUser
          supabase.from('messages').update({ read_by: payload.new.read_by }).eq('id', payload.new.id).then()
        }
        messages.value.push(payload.new)
        scrollToBottom()
        updateLastRead()
      }
    })
    .on('postgres_changes', { 
      event: 'UPDATE', 
      schema: 'public', 
      table: 'messages',
      filter: `room_id=eq.${roomId}`
    }, (payload) => {
      const index = messages.value.findIndex(m => m.id === payload.new.id)
      if (index !== -1) {
        messages.value[index] = payload.new
      }
    })
    .subscribe(async (status) => {
      if (status === 'SUBSCRIBED') {
        await roomChannel.track({
          username: currentUser
        })
      }
    })
})

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
        :class="{ 'my-message': msg.sender === currentUser || msg.user === currentUser }"
      >
        <div v-if="msg.sender !== currentUser && msg.user !== currentUser" class="sender-name">
          {{ getAvatarEmoji(msg.sender || msg.user) }} {{ msg.sender || msg.user }}
        </div>
        
        <div class="message-row">
          <!-- 내가 보낸 메시지: 안 읽은 사람 수 (왼쪽) -->
          <span v-if="(msg.sender === currentUser || msg.user === currentUser) && getUnreadCount(msg) > 0" class="unread-count">
            {{ getUnreadCount(msg) }}
          </span>

          <div class="message-bubble" :class="{ 'has-image': msg.image_url, 'is-poll': msg.type === 'poll' }">
            
            <!-- 텍스트 또는 이미지 메시지 -->
            <template v-if="!msg.type || msg.type === 'text'">
              <img 
                v-if="msg.image_url" 
                :src="msg.image_url" 
                class="message-image" 
                alt="첨부 이미지" 
                @click="downloadImage(msg.image_url)"
                title="클릭하여 다운로드"
              />
              <div v-if="msg.text" class="message-text">{{ msg.text }}</div>
            </template>

            <!-- 투표 메시지 -->
            <template v-if="msg.type === 'poll' && msg.poll_data">
              <div class="poll-container">
                <h4>📊 {{ msg.poll_data.question }}</h4>
                <div 
                  v-for="opt in msg.poll_data.options" 
                  :key="opt.id" 
                  class="poll-option" 
                  @click="votePoll(msg.id, opt.id)"
                  :class="{'voted': opt.votes.includes(currentUser)}"
                >
                  <div class="poll-bar" :style="{ width: getPollPercentage(msg.poll_data, opt) + '%' }"></div>
                  <div class="poll-opt-content">
                    <span class="poll-text">{{ opt.text }}</span>
                    <span class="poll-votes" v-if="opt.votes.length > 0">{{ opt.votes.length }}명</span>
                  </div>
                </div>
              </div>
            </template>

          </div>

          <!-- 남이 보낸 메시지: 안 읽은 사람 수 (오른쪽) -->
          <span v-if="msg.sender !== currentUser && msg.user !== currentUser && getUnreadCount(msg) > 0" class="unread-count">
            {{ getUnreadCount(msg) }}
          </span>
          
          <div class="time-container">
            <span class="message-time text-secondary">{{ msg.time }}</span>
          </div>
        </div>
      </div>
    </div>

    <!-- 투표 만들기 모달 -->
    <div v-if="showPollModal" class="poll-modal-overlay" @click="togglePollModal">
      <div class="poll-modal" @click.stop>
        <h3>📊 투표 만들기</h3>
        <input type="text" v-model="pollQuestion" placeholder="질문을 입력하세요" class="poll-input main-input" />
        
        <div class="poll-options-list">
          <input 
            v-for="(opt, idx) in pollOptions" 
            :key="idx" 
            type="text" 
            v-model="opt.text" 
            :placeholder="`항목 ${idx + 1}`" 
            class="poll-input" 
          />
        </div>
        
        <button class="add-opt-btn" @click="addPollOption">+ 항목 추가</button>
        
        <div class="poll-actions">
          <button class="btn-secondary" @click="togglePollModal">취소</button>
          <button class="btn-primary" @click="createPoll">투표 등록</button>
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
      <button class="icon-btn" @click="toggleEmojiPicker" :disabled="isUploading" title="이모티콘">😀</button>
      <input type="file" ref="fileInput" accept="image/*" style="display: none" @change="handleFileUpload" />
      <button class="icon-btn" @click="triggerFileInput" :disabled="isUploading" title="사진 전송">
        {{ isUploading ? '⏳' : '📎' }}
      </button>
      <button class="icon-btn" @click="togglePollModal" :disabled="isUploading" title="투표 만들기">📊</button>
      
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
  height: 100dvh;
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
  padding-bottom: 40px;
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
  flex-direction: row; /* my-message 컨테이너 안에서 왼쪽 요소가 자연스럽게 위치하도록 */
}

/* 읽음 표시 카운트 */
.unread-count {
  font-size: 0.75rem;
  font-weight: 700;
  color: #FFC107; /* 카카오톡과 유사한 노란색/주황색 계열 */
  margin-bottom: 2px;
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

.message-bubble.is-poll {
  padding: 15px;
  background-color: var(--color-surface);
  min-width: 220px;
}

.my-message .message-bubble:not(.has-image):not(.is-poll) {
  background-color: var(--color-message-sent);
  color: var(--color-message-sent-text);
  border-top-right-radius: 4px;
  border-top-left-radius: var(--radius-md);
}

.message-wrapper:not(.my-message) .message-bubble:not(.has-image):not(.is-poll) {
  border-top-left-radius: 4px;
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

/* 투표 UI 스타일 */
.poll-container h4 {
  margin: 0 0 12px 0;
  font-size: 1rem;
  color: var(--color-text);
}

.poll-option {
  position: relative;
  background: rgba(0,0,0,0.04);
  border-radius: 6px;
  margin-bottom: 8px;
  cursor: pointer;
  overflow: hidden;
  border: 1px solid transparent;
  transition: all 0.2s;
}

.poll-option.voted {
  border-color: var(--color-primary);
  background: rgba(107, 78, 255, 0.05);
}

.poll-bar {
  position: absolute;
  left: 0;
  top: 0;
  bottom: 0;
  background-color: rgba(107, 78, 255, 0.15);
  transition: width 0.3s ease;
}

.poll-option.voted .poll-bar {
  background-color: rgba(107, 78, 255, 0.3);
}

.poll-opt-content {
  position: relative;
  padding: 10px 12px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  z-index: 1;
}

.poll-text {
  font-size: 0.9rem;
  font-weight: 500;
  color: var(--color-text);
}

.poll-votes {
  font-size: 0.8rem;
  font-weight: bold;
  color: var(--color-primary);
}

/* 모달 스타일 */
.poll-modal-overlay {
  position: fixed;
  top: 0; left: 0; right: 0; bottom: 0;
  background: rgba(0,0,0,0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.poll-modal {
  background: var(--color-surface);
  width: 90%;
  max-width: 400px;
  border-radius: var(--radius-lg);
  padding: 20px;
  box-shadow: var(--shadow-lg);
}

.poll-modal h3 {
  margin-top: 0;
  margin-bottom: 15px;
  font-size: 1.2rem;
}

.poll-input {
  width: 100%;
  padding: 10px;
  border: 1px solid #ddd;
  border-radius: 6px;
  margin-bottom: 10px;
  font-family: inherit;
}

.poll-input.main-input {
  font-weight: bold;
  border-color: var(--color-primary);
  margin-bottom: 15px;
}

.add-opt-btn {
  background: none;
  border: none;
  color: var(--color-primary);
  font-weight: 600;
  padding: 10px 0;
  cursor: pointer;
  margin-bottom: 15px;
}

.poll-actions {
  display: flex;
  gap: 10px;
  justify-content: flex-end;
}

.poll-actions button {
  padding: 10px 16px;
  border-radius: 6px;
  font-weight: bold;
  cursor: pointer;
  border: none;
}

.btn-secondary {
  background: #f0f0f0;
  color: #333;
}

.btn-primary {
  background: var(--color-primary);
  color: white;
}

.time-container {
  display: flex;
  flex-direction: column;
  justify-content: flex-end;
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
