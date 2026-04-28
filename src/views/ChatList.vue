<script setup>
import { ref, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import { supabase } from '../supabase'

const router = useRouter()

const chatRooms = ref([])
let roomsChannel = null
let messagesChannel = null

const familyCode = localStorage.getItem('family_code') || 'kimfamily'
const familyName = localStorage.getItem('family_name') || '우리끼리 톡'
const isLoading = ref(true)

const fetchRooms = async () => {
  const { data: rooms, error } = await supabase
    .from('rooms')
    .select('*')
    .eq('family_code', familyCode)
    .order('created_at', { ascending: false })
  
  if (error) {
    console.error('Error fetching rooms:', error)
  } else if (rooms) {
    const enrichedRooms = await Promise.all(rooms.map(async (room) => {
      // 이 기기에서 이 방을 마지막으로 읽은 시간
      const lastRead = localStorage.getItem(`last_read_${room.id}`) || '1970-01-01T00:00:00.000Z'

      // 1. 최근 메시지 조회
      const { data: lastMsgData } = await supabase
        .from('messages')
        .select('*')
        .eq('room_id', room.id)
        .order('created_at', { ascending: false })
        .limit(1)

      let lastMessage = '대화를 시작해 보세요.'
      let time = new Date(room.created_at).toLocaleDateString()

      if (lastMsgData && lastMsgData.length > 0) {
        const msg = lastMsgData[0]
        lastMessage = msg.image_url ? '사진을 보냈습니다 📷' : msg.text
        
        // 오늘 온 메시지는 시간, 이전은 날짜 표시
        const msgDate = new Date(msg.created_at)
        const today = new Date()
        if (msgDate.toDateString() === today.toDateString()) {
          time = msg.time // "오후 3:20" 등
        } else {
          time = `${msgDate.getMonth() + 1}월 ${msgDate.getDate()}일`
        }
      }

      // 2. 안 읽은 메시지 개수 조회
      const { count } = await supabase
        .from('messages')
        .select('*', { count: 'exact', head: true })
        .eq('room_id', room.id)
        .gt('created_at', lastRead)

      return {
        id: room.id,
        title: room.title,
        lastMessage,
        time,
        unread: count || 0
      }
    }))
    
    // 최근 메시지 순서대로 다시 정렬 (옵션)
    chatRooms.value = enrichedRooms
  }
  isLoading.value = false
}

const goToChat = (id) => {
  router.push(`/chat/${id}`)
}

const avatarColors = ['#FF6B6B', '#4ECDC4', '#45B7D1', '#FFA07A', '#98D8C8', '#F06292', '#BA68C8', '#4DB6AC', '#FFD54F', '#A1887F']

const getAvatarColor = (id) => {
  return avatarColors[id % avatarColors.length]
}

const addRoom = async () => {
  const title = prompt('새로운 채팅방 이름을 입력하세요:')
  if (!title || !title.trim()) return

  const { data, error } = await supabase
    .from('rooms')
    .insert([{ title: title.trim(), family_code: familyCode }])
    .select() // 생성된 방 데이터를 받아옴
    
  if (error) {
    console.error('방 생성 에러:', error)
    alert('방 생성에 실패했습니다.')
  } else if (data && data.length > 0) {
    // 방이 성공적으로 만들어지면 즉시 해당 채팅방으로 이동
    goToChat(data[0].id)
  } else {
    // 혹시 데이터를 못 받아오면 수동 선택 안내
    alert('방이 생성되었습니다! 목록에서 방을 선택해 주세요.')
  }
}

const deleteRoom = async (id, title) => {
  const confirmed = confirm(`'${title}' 채팅방을 정말 삭제하시겠습니까?\n(방 목록에서만 지워집니다)`)
  if (!confirmed) return

  const { error } = await supabase
    .from('rooms')
    .delete()
    .eq('id', id)

  if (error) {
    console.error('방 삭제 에러:', error)
    alert('방 삭제에 실패했습니다.')
  } else {
    // 성공 시 화면에서 즉시 제거 (새로고침 효과)
    chatRooms.value = chatRooms.value.filter(room => room.id !== id)
  }
}

onMounted(() => {
  fetchRooms()

  roomsChannel = supabase.channel(`public:rooms:${familyCode}`)
    .on('postgres_changes', { 
      event: 'INSERT', 
      schema: 'public', 
      table: 'rooms',
      filter: `family_code=eq.${familyCode}`
    }, payload => {
      const newRoom = payload.new
      chatRooms.value.unshift({
        id: newRoom.id,
        title: newRoom.title,
        lastMessage: '대화를 시작해 보세요.',
        time: new Date(newRoom.created_at).toLocaleDateString(),
        unread: 0
      })
    })
    .on('postgres_changes', { 
      event: 'DELETE', 
      schema: 'public', 
      table: 'rooms',
      filter: `family_code=eq.${familyCode}`
    }, payload => {
      chatRooms.value = chatRooms.value.filter(room => room.id !== payload.old.id)
    })
    .subscribe()

  messagesChannel = supabase.channel(`public:messages:${familyCode}`)
    .on('postgres_changes', { 
      event: 'INSERT', 
      schema: 'public', 
      table: 'messages',
      filter: `family_code=eq.${familyCode}`
    }, payload => {
      const msg = payload.new
      const roomIndex = chatRooms.value.findIndex(r => r.id === msg.room_id)
      
      if (roomIndex !== -1) {
        const room = chatRooms.value[roomIndex]
        room.lastMessage = msg.image_url ? '사진을 보냈습니다 📷' : msg.text
        room.time = msg.time
        room.unread += 1
        
        chatRooms.value.splice(roomIndex, 1)
        chatRooms.value.unshift(room)
      } else {
        fetchRooms()
      }
    })
    .subscribe()
})

onUnmounted(() => {
  if (roomsChannel) supabase.removeChannel(roomsChannel)
  if (messagesChannel) supabase.removeChannel(messagesChannel)
})

const changeUsername = () => {
  const currentName = localStorage.getItem('chat_username') || '익명'
  const newName = prompt('변경할 닉네임을 입력하세요:', currentName)
  if (newName && newName.trim() !== '') {
    localStorage.setItem('chat_username', newName.trim())
    alert(`닉네임이 '${newName.trim()}'(으)로 변경되었습니다.`)
  }
}

const handleLogout = () => {
  localStorage.removeItem('family_code')
  localStorage.removeItem('family_name')
  localStorage.removeItem('chat_username')
  router.push('/')
}
</script>

<template>
  <div class="chat-list-view flex-col animate-fade-in">
    <header class="app-header">
      <h1 class="header-title font-bold">{{ familyName }}</h1>
      <div class="header-actions">
        <button class="icon-btn" @click="addRoom" title="새 방 만들기">➕</button>
        <button class="icon-btn" @click="handleLogout" title="로그아웃">🚪</button>
      </div>
    </header>

    <div class="chat-list-container">
      <div v-if="isLoading" class="loading-state flex-col flex-center">
        <div class="spinner"></div>
        <p>채팅방 목록을 불러오는 중입니다...</p>
      </div>
      
      <div v-else-if="chatRooms.length === 0" class="empty-state flex-col flex-center">
        <p>개설된 채팅방이 없습니다.<br/>새로운 방을 만들어 보세요!</p>
      </div>

      <div 
        v-else
        v-for="room in chatRooms" 
        :key="room.id" 
        class="chat-room-item"
        @click="goToChat(room.id)"
      >
        <div class="profile-avatar" :style="{ backgroundColor: getAvatarColor(room.id) }">
          {{ room.title.slice(0, 1) }}
        </div>
        
        <div class="chat-info">
          <div class="chat-header">
            <span class="chat-title font-bold">{{ room.title }}</span>
            <span class="chat-time text-secondary">{{ room.time }}</span>
          </div>
          <div class="chat-footer">
            <span class="chat-last-message text-secondary">{{ room.lastMessage }}</span>
            <div class="footer-actions">
              <span v-if="room.unread > 0" class="unread-badge">{{ room.unread }}</span>
              <button class="delete-btn" @click.stop="deleteRoom(room.id, room.title)" title="방 삭제">🗑️</button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 하단 네비게이션 바 -->
    <nav class="bottom-nav">
      <div class="nav-item active">
        <span class="nav-icon">💬</span>
        <span class="nav-text">채팅</span>
      </div>
      <div class="nav-item" @click="router.push('/calendar')">
        <span class="nav-icon">🗓️</span>
        <span class="nav-text">일정</span>
      </div>
    </nav>
  </div>
</template>

<style scoped>
.chat-list-view {
  height: 100vh;
  background-color: var(--color-surface);
}

.app-header {
  height: var(--header-height);
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 20px;
  background-color: var(--color-surface);
  border-bottom: 1px solid var(--color-surface-elevated);
  position: sticky;
  top: 0;
  z-index: 10;
}

.header-title {
  font-size: 1.4rem;
}

.header-actions {
  display: flex;
  gap: 8px;
}

.icon-btn {
  background: none;
  border: none;
  font-size: 1.2rem;
  cursor: pointer;
  padding: 8px;
}

.chat-list-container {
  flex: 1;
  overflow-y: auto;
  padding-bottom: var(--bottom-nav-height);
}

.chat-room-item {
  display: flex;
  padding: 16px 20px;
  align-items: center;
  gap: 16px;
  cursor: pointer;
  transition: background-color 0.2s ease;
}

.chat-room-item:active {
  background-color: var(--color-surface-elevated);
}

.profile-avatar {
  width: 50px;
  height: 50px;
  border-radius: var(--radius-full);
  background-color: var(--color-primary-light);
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.2rem;
  font-weight: bold;
}

.chat-info {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.chat-header {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
}

.chat-title {
  font-size: 1.1rem;
}

.chat-time {
  font-size: 0.8rem;
}

.chat-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.footer-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

.delete-btn {
  background: none;
  border: none;
  font-size: 1.1rem;
  cursor: pointer;
  padding: 4px;
  border-radius: 4px;
  opacity: 0.6;
  transition: opacity 0.2s, background-color 0.2s;
}

.delete-btn:hover {
  opacity: 1;
  background-color: rgba(255, 75, 75, 0.1);
}

.chat-last-message {
  font-size: 0.95rem;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 200px;
}

.unread-badge {
  background-color: var(--color-danger);
  color: white;
  border-radius: 10px;
  min-width: 20px;
  height: 20px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.75rem;
  font-weight: bold;
  padding: 0 6px;
}

.bottom-nav {
  height: var(--bottom-nav-height);
  position: fixed;
  bottom: 0;
  width: 100%;
  background-color: var(--color-surface);
  border-top: 1px solid var(--color-surface-elevated);
  display: flex;
  justify-content: space-around;
  align-items: center;
  z-index: 10;
  padding-bottom: env(safe-area-inset-bottom);
}

.nav-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  color: var(--color-text-secondary);
  cursor: pointer;
  padding: 8px;
  border-radius: 8px;
  transition: background-color 0.2s;
}

.nav-item:active {
  background-color: var(--color-surface-elevated);
}

.nav-item.active {
  color: var(--color-primary);
}

.nav-icon {
  font-size: 1.2rem;
}

.nav-text {
  font-size: 0.75rem;
  font-weight: 500;
}

.loading-state, .empty-state {
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--color-text-secondary);
  text-align: center;
  padding: 20px;
  line-height: 1.5;
}

.spinner {
  width: 30px;
  height: 30px;
  border: 3px solid rgba(107, 78, 255, 0.2);
  border-top-color: var(--color-primary);
  border-radius: 50%;
  animation: spin 1s linear infinite;
  margin-bottom: 15px;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}
</style>
