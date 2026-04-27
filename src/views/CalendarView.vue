<script setup>
import { ref, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import { supabase } from '../supabase'

const router = useRouter()
const events = ref([])
let eventsChannel = null

const currentUser = localStorage.getItem('chat_username') || '익명'
const familyCode = localStorage.getItem('family_code') || 'kimfamily'

const fetchEvents = async () => {
  const { data, error } = await supabase
    .from('calendar_events')
    .select('*')
    .eq('family_code', familyCode)
    .order('event_date', { ascending: true }) // 다가오는 순
    
  if (error) {
    console.error('일정 불러오기 에러:', error)
  } else if (data) {
    events.value = data
  }
}

const addEvent = async () => {
  const title = prompt('새로운 일정 이름을 입력하세요:\n(예: 부모님 생신, 가족 여행)')
  if (!title || !title.trim()) return
  
  const dateStr = prompt('날짜를 입력하세요 (YYYY-MM-DD 형식):\n(예: 2026-05-15)', new Date().toISOString().split('T')[0])
  if (!dateStr) return
  
  // 간단한 날짜 유효성 검사
  const dateRegex = /^\d{4}-\d{2}-\d{2}$/
  if (!dateRegex.test(dateStr)) {
    alert('날짜 형식이 올바르지 않습니다. (YYYY-MM-DD)')
    return
  }

  const { data, error } = await supabase
    .from('calendar_events')
    .insert([{ title: title.trim(), event_date: dateStr, creator: currentUser, family_code: familyCode }])
    .select()
    
  if (error) {
    console.error('일정 추가 에러:', error)
    alert('일정 추가에 실패했습니다.')
  } else if (data && data.length > 0) {
    // 성공 시 화면에 즉시 반영 (옵티미스틱 업데이트)
    events.value.push(data[0])
    // 날짜 오름차순으로 재정렬
    events.value.sort((a, b) => new Date(a.event_date) - new Date(b.event_date))
  }
}

const deleteEvent = async (id, title) => {
  const confirmed = confirm(`'${title}' 일정을 삭제하시겠습니까?`)
  if (!confirmed) return

  const { error } = await supabase
    .from('calendar_events')
    .delete()
    .eq('id', id)

  if (error) {
    console.error('일정 삭제 에러:', error)
    alert('일정 삭제에 실패했습니다.')
  } else {
    events.value = events.value.filter(e => e.id !== id)
  }
}

const getDDay = (dateStr) => {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const eventDate = new Date(dateStr)
  eventDate.setHours(0, 0, 0, 0)
  
  const diffTime = eventDate - today
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
  
  if (diffDays === 0) return 'D-Day 🎉'
  if (diffDays > 0) return `D-${diffDays}`
  return `D+${Math.abs(diffDays)}`
}

onMounted(() => {
  fetchEvents()

  eventsChannel = supabase.channel(`public:calendar_events:${familyCode}`)
    .on('postgres_changes', { 
      event: '*', 
      schema: 'public', 
      table: 'calendar_events',
      filter: `family_code=eq.${familyCode}`
    }, () => {
      // 추가, 삭제, 변경 모두 갱신하기 위해 단순히 다시 불러옴
      fetchEvents()
    })
    .subscribe()
})

onUnmounted(() => {
  if (eventsChannel) supabase.removeChannel(eventsChannel)
})
</script>

<template>
  <div class="calendar-view flex-col animate-fade-in">
    <header class="app-header">
      <h1 class="header-title font-bold">가족 캘린더 🗓️</h1>
      <button class="icon-btn" @click="addEvent" title="새 일정 추가">➕</button>
    </header>

    <div class="calendar-container">
      <div v-if="events.length === 0" class="empty-state">
        <div class="empty-icon">🏖️</div>
        <p>등록된 가족 일정이 없습니다.</p>
        <p class="text-secondary text-sm">우측 상단 ➕ 버튼을 눌러 일정을 추가해 보세요.</p>
      </div>
      
      <div 
        v-for="event in events" 
        :key="event.id" 
        class="event-item"
        :class="{ 'is-past': getDDay(event.event_date).includes('+') }"
      >
        <div class="event-dday font-bold" :class="getDDay(event.event_date).includes('D-Day') ? 'dday-today' : ''">
          {{ getDDay(event.event_date) }}
        </div>
        
        <div class="event-info">
          <div class="event-title font-bold">{{ event.title }}</div>
          <div class="event-date text-secondary">
            {{ new Date(event.event_date).toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'short' }) }}
            <span class="event-creator">· 등록: {{ event.creator }}</span>
          </div>
        </div>
        
        <button class="delete-btn" @click="deleteEvent(event.id, event.title)">🗑️</button>
      </div>
    </div>

    <!-- 하단 네비게이션 바 -->
    <nav class="bottom-nav">
      <div class="nav-item" @click="router.push('/chats')">
        <span class="nav-icon">💬</span>
        <span class="nav-text">채팅</span>
      </div>
      <div class="nav-item active">
        <span class="nav-icon">🗓️</span>
        <span class="nav-text">일정</span>
      </div>
    </nav>
  </div>
</template>

<style scoped>
.calendar-view {
  height: 100vh;
  height: 100dvh;
  background-color: var(--color-background);
  display: flex;
  flex-direction: column;
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

.icon-btn {
  background: none;
  border: none;
  font-size: 1.2rem;
  cursor: pointer;
  padding: 8px;
}

.calendar-container {
  flex: 1;
  overflow-y: auto;
  padding: 16px;
  padding-bottom: calc(var(--bottom-nav-height) + 20px);
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 60%;
  text-align: center;
  gap: 8px;
  color: var(--color-text);
}

.empty-icon {
  font-size: 3rem;
  margin-bottom: 8px;
}

.event-item {
  display: flex;
  align-items: center;
  background-color: var(--color-surface);
  padding: 16px;
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-sm);
  gap: 16px;
  transition: transform 0.2s;
}

.event-item.is-past {
  opacity: 0.6;
}

.event-dday {
  background-color: var(--color-primary-light);
  color: white;
  padding: 8px 12px;
  border-radius: var(--radius-md);
  font-size: 1.1rem;
  min-width: 75px;
  text-align: center;
}

.event-dday.dday-today {
  background-color: #FF6B6B;
  animation: pulse 2s infinite;
}

.event-info {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.event-title {
  font-size: 1.1rem;
}

.event-date {
  font-size: 0.85rem;
}

.event-creator {
  margin-left: 6px;
  opacity: 0.7;
}

.delete-btn {
  background: none;
  border: none;
  font-size: 1.1rem;
  cursor: pointer;
  padding: 8px;
  opacity: 0.6;
  transition: opacity 0.2s;
}

.delete-btn:hover {
  opacity: 1;
}

@keyframes pulse {
  0% { transform: scale(1); }
  50% { transform: scale(1.05); }
  100% { transform: scale(1); }
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
</style>
