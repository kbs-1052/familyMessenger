<script setup>
import { ref, watch, onUnmounted, onMounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { supabase } from './supabase'

const router = useRouter()
const route = useRoute()
const toast = ref({ show: false, title: '', message: '', roomId: null })
const d1Alert = ref({ show: false, title: '' }) // D-1 알림 상태
let globalChannel = null
let currentFamilyCode = null

const playSound = () => {
  try {
    // 띠링~ 하는 짧고 맑은 알림음
    const audio = new Audio('https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3')
    audio.play().catch(e => console.log('오디오 자동재생 차단됨 (사용자가 먼저 화면을 클릭해야 재생 가능)', e))
  } catch (e) {
    console.log('오디오 재생 에러', e)
  }
}

const setupGlobalListener = (familyCode) => {
  if (globalChannel) {
    supabase.removeChannel(globalChannel)
    globalChannel = null
  }
  if (!familyCode) return

  globalChannel = supabase.channel(`global_notifications:${familyCode}`)
    .on('postgres_changes', { 
      event: 'INSERT', 
      schema: 'public', 
      table: 'messages',
      filter: `family_code=eq.${familyCode}`
    }, payload => {
      const msg = payload.new
      const myUsername = localStorage.getItem('chat_username')
      
      // 내가 보낸 메시지는 알림에서 제외
      if (msg.user === myUsername || msg.sender === myUsername) return

      // 현재 해당 채팅방에 들어가 있으면 팝업을 띄우지 않음
      if (route.name === 'ChatRoom' && String(route.params.id) === String(msg.room_id)) {
        return
      }

      const title = `${msg.user || msg.sender || '모임원'}님의 새 메시지`
      const body = msg.image_url ? '사진을 보냈습니다 📷' : msg.text

      // 소리 재생 및 토스트 팝업 표시
      playSound()
      toast.value = {
        show: true,
        title: title,
        message: body,
        roomId: msg.room_id
      }
      
      // 3.5초 후 팝업 자동 닫힘
      setTimeout(() => { toast.value.show = false }, 3500)

      // OS 네이티브 알림 표시 (권한 허용 시) - 앱이 백그라운드에 있을 때도 카톡처럼 상단에 뜸
      if ('Notification' in window && Notification.permission === 'granted') {
        // 이미 화면을 보고 있다면 굳이 네이티브 알림을 안 띄움
        if (document.visibilityState === 'hidden') {
          const noti = new Notification(title, {
            body: body,
            icon: '/family-icon.png' // manifest에 있는 아이콘
          })
          noti.onclick = () => {
            window.focus()
            goToRoom(msg.room_id)
            noti.close()
          }
        }
      }
    })
    .subscribe()
}

// 내일 일정(D-1) 확인
const checkD1Events = async (familyCode) => {
  if (!familyCode) return
  
  const today = new Date()
  const tomorrow = new Date(today)
  tomorrow.setDate(tomorrow.getDate() + 1)
  
  // YYYY-MM-DD 형식으로 내일 날짜 생성
  const tzOffset = tomorrow.getTimezoneOffset() * 60000
  const localTomorrow = new Date(tomorrow.getTime() - tzOffset)
  const tomorrowStr = localTomorrow.toISOString().split('T')[0]

  const { data, error } = await supabase
    .from('calendar_events')
    .select('*')
    .eq('family_code', familyCode)
    .eq('event_date', tomorrowStr)

  if (!error && data && data.length > 0) {
    // 첫 번째 D-1 이벤트 알림
    d1Alert.value = {
      show: true,
      title: data[0].title
    }
  }
}

// 앱이 처음 켜질 때 알림 리스너 설정
onMounted(() => {
  const code = localStorage.getItem('family_code')
  if (code) {
    currentFamilyCode = code
    setupGlobalListener(code)
    checkD1Events(code)
  }
})

// 로그인/로그아웃 등으로 화면(라우트)이 바뀔 때 가족 코드가 변경되었는지 확인하고 리스너 재설정
watch(() => route.path, () => {
  const code = localStorage.getItem('family_code')
  if (code !== currentFamilyCode) {
    currentFamilyCode = code
    setupGlobalListener(code)
    checkD1Events(code)
  }
})

onUnmounted(() => {
  if (globalChannel) supabase.removeChannel(globalChannel)
})

const goToRoom = (roomId) => {
  toast.value.show = false
  if (roomId) router.push(`/chat/${roomId}`)
}
</script>

<template>
  <div class="app-root">
    <router-view />

    <!-- 글로벌 알림 토스트 (옵션 1) -->
    <Transition name="toast">
      <div v-if="toast.show" class="toast-popup" @click="goToRoom(toast.roomId)">
        <div class="toast-icon">🔔</div>
        <div class="toast-content">
          <h4>{{ toast.title }}</h4>
          <p>{{ toast.message }}</p>
        </div>
      </div>
    </Transition>

    <!-- D-1 이벤트 특별 알림 -->
    <Transition name="fade">
      <div v-if="d1Alert.show" class="d1-overlay" @click="d1Alert.show = false">
        <div class="d1-card" @click.stop>
          <div class="d1-icon animate-bounce">🎉</div>
          <h2>내일은 특별한 날!</h2>
          <p><strong>{{ d1Alert.title }}</strong> 일정이 하루 남았습니다!</p>
          <button class="btn-primary" @click="d1Alert.show = false">확인</button>
        </div>
      </div>
    </Transition>
  </div>
</template>

<style scoped>
.app-root {
  width: 100%;
  height: 100vh;
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

/* 토스트 팝업 애니메이션 */
.toast-enter-active,
.toast-leave-active {
  transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
}

.toast-enter-from,
.toast-leave-to {
  opacity: 0;
  transform: translate(-50%, -40px);
}

/* 토스트 팝업 디자인 */
.toast-popup {
  position: fixed;
  top: 20px;
  left: 50%;
  transform: translateX(-50%);
  background: var(--color-surface, #ffffff);
  color: var(--color-text, #333333);
  padding: 15px 20px;
  border-radius: var(--radius-lg, 16px);
  box-shadow: 0 10px 25px rgba(0,0,0,0.2);
  display: flex;
  align-items: center;
  gap: 15px;
  z-index: 9999;
  cursor: pointer;
  width: 90%;
  max-width: 400px;
  border-left: 4px solid var(--color-primary, #6b4eff);
}

.toast-icon {
  font-size: 1.5rem;
}

.toast-content h4 {
  margin: 0;
  font-size: 0.95rem;
  font-weight: 700;
}

.toast-content p {
  margin: 5px 0 0;
  font-size: 0.85rem;
  color: var(--color-text-secondary, #666666);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 250px;
}

/* D-1 알림 디자인 */
.d1-overlay {
  position: fixed;
  top: 0; left: 0; right: 0; bottom: 0;
  background: rgba(0,0,0,0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 10000;
  backdrop-filter: blur(5px);
}

.d1-card {
  background: var(--color-surface, #ffffff);
  padding: 40px;
  border-radius: var(--radius-lg, 16px);
  text-align: center;
  box-shadow: 0 10px 30px rgba(0,0,0,0.3);
  max-width: 85%;
  animation: slide-up 0.3s ease-out;
}

.d1-icon {
  font-size: 4rem;
  margin-bottom: 20px;
}

.d1-card h2 {
  color: var(--color-primary, #6b4eff);
  margin-bottom: 10px;
  font-size: 1.5rem;
}

.d1-card p {
  font-size: 1.1rem;
  margin-bottom: 30px;
  line-height: 1.5;
}

.d1-card .btn-primary {
  width: 100%;
  padding: 15px;
  background-color: var(--color-primary, #6b4eff);
  color: white;
  border: none;
  border-radius: var(--radius-sm, 8px);
  font-size: 1rem;
  font-weight: bold;
  cursor: pointer;
}

@keyframes slide-up {
  from { opacity: 0; transform: translateY(30px); }
  to { opacity: 1; transform: translateY(0); }
}

@keyframes bounce {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-10px); }
}
.animate-bounce {
  animation: bounce 2s infinite;
}
</style>
