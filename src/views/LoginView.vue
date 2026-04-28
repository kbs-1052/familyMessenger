<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { supabase } from '../supabase'

const router = useRouter()
const familyCode = ref('')
const password = ref('')
const showPassword = ref(false)
const name = ref('')
const familyName = ref('') // 가족 이름 (가입용)
const isRegistering = ref(false) // 가입 모드 여부

const toggleMode = () => {
  isRegistering.value = !isRegistering.value
  familyCode.value = ''
  password.value = ''
  name.value = ''
  familyName.value = ''
}

const togglePassword = () => {
  showPassword.value = !showPassword.value
}

const handleRegister = async () => {
  if (!familyCode.value || !password.value || !familyName.value) {
    alert('모든 항목을 입력해주세요.')
    return
  }

  // 중복 코드 확인 및 가입 처리
  const { data: existing } = await supabase
    .from('family_auth')
    .select('access_code')
    .eq('access_code', familyCode.value)
    .single()

  if (existing) {
    alert('이미 사용 중인 접속코드입니다. 다른 코드를 입력해주세요.')
    return
  }

  const { error } = await supabase
    .from('family_auth')
    .insert([{ 
      access_code: familyCode.value, 
      password: password.value, 
      family_name: familyName.value 
    }])

  if (error) {
    alert('가족 등록에 실패했습니다.')
    console.error(error)
  } else {
    // 가족 멤버 등록
    await supabase.from('family_members').insert([
      { family_code: familyCode.value, username: name.value || '가장' }
    ]).select()
    
    alert('가족 계정이 생성되었습니다! 이제 로그인해 주세요.')
    isRegistering.value = false
  }
}

const handleLogin = async () => {
  if (!familyCode.value || !password.value || !name.value) {
    alert('모든 항목을 입력해주세요.')
    return
  }

  // 데이터베이스에서 접속코드와 비밀번호 확인
  const { data, error } = await supabase
    .from('family_auth')
    .select('*')
    .eq('access_code', familyCode.value)
    .eq('password', password.value)
    .single()

  if (error || !data) {
    alert('접속코드 또는 비밀번호가 일치하지 않습니다.')
    console.error('로그인 에러:', error)
  } else {
    // 성공 시 가족 멤버 테이블에 내 이름 등록 (중복 시 무시)
    await supabase.from('family_members').upsert([
      { family_code: data.access_code, username: name.value }
    ], { onConflict: 'family_code, username' })

    // 로그인 성공 시 로컬 스토리지에 정보 저장
    localStorage.setItem('family_code', data.access_code)
    localStorage.setItem('family_name', data.family_name)
    localStorage.setItem('chat_username', name.value)
    router.push('/chats')
  }
}
</script>

<template>
  <div class="login-container flex-col flex-center animate-fade-in">
    <div class="login-card flex-col animate-slide-up">
      <div class="logo-area flex-col flex-center">
        <img src="/icon.png" alt="가족톡 로고" class="custom-app-logo" />
        <h1 class="glow-text">{{ isRegistering ? '새 가족 등록' : '우리 가족 톡' }}</h1>
        <p class="text-secondary">{{ isRegistering ? '우리 가족만의 공간을 만들어보세요' : '프라이빗 가족 메신저' }}</p>
      </div>

      <form v-if="!isRegistering" @submit.prevent="handleLogin" class="login-form flex-col">
        <div class="input-group">
          <label for="code">접속코드 (Access Code)</label>
          <input 
            type="text" 
            id="code" 
            v-model="familyCode" 
            placeholder="우리 가족 고유 코드"
          />
        </div>

        <div class="input-group">
          <label for="pwd">비밀번호</label>
          <div class="pwd-input-wrapper">
            <input 
              :type="showPassword ? 'text' : 'password'" 
              id="pwd" 
              v-model="password" 
              placeholder="비밀번호"
            />
            <button type="button" class="eye-btn" @click="togglePassword" title="비밀번호 보기/숨기기">
              {{ showPassword ? '👁️' : '🙈' }}
            </button>
          </div>
        </div>
        
        <div class="input-group">
          <label for="name">이름 (호칭)</label>
          <input 
            type="text" 
            id="name" 
            v-model="name" 
            placeholder="예: 엄마, 아빠, 첫째"
          />
        </div>

        <button type="submit" class="btn-primary font-bold">입장하기</button>
        <button type="button" @click="toggleMode" class="btn-secondary">처음이신가요? 새 가족 등록하기</button>
      </form>

      <form v-else @submit.prevent="handleRegister" class="login-form flex-col">
        <div class="input-group">
          <label for="reg-family-name">가족 이름</label>
          <input 
            type="text" 
            id="reg-family-name" 
            v-model="familyName" 
            placeholder="예: 김씨네 가족, 행복한 우리집"
          />
        </div>

        <div class="input-group">
          <label for="reg-code">새 접속코드 (Access Code)</label>
          <input 
            type="text" 
            id="reg-code" 
            v-model="familyCode" 
            placeholder="가족이 함께 쓸 고유 코드"
          />
        </div>

        <div class="input-group">
          <label for="reg-pwd">새 비밀번호</label>
          <input 
            type="password" 
            id="reg-pwd" 
            v-model="password" 
            placeholder="비밀번호 설정"
          />
        </div>

        <button type="submit" class="btn-primary font-bold">가족 등록 완료</button>
        <button type="button" @click="toggleMode" class="btn-secondary">이미 계정이 있나요? 로그인하기</button>
      </form>
    </div>
  </div>
</template>

<style scoped>
.login-container {
  height: 100vh;
  /* 동적 애니메이션 그라데이션 배경 */
  background: linear-gradient(-45deg, #ee7752, #e73c7e, #23a6d5, #23d5ab, #6b4eff);
  background-size: 400% 400%;
  animation: gradientBG 15s ease infinite;
  padding: 20px;
}

@keyframes gradientBG {
  0% { background-position: 0% 50%; }
  50% { background-position: 100% 50%; }
  100% { background-position: 0% 50%; }
}

.login-card {
  /* 글래스모피즘 (반투명 유리 질감) */
  background: rgba(255, 255, 255, 0.85);
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
  border: 1px solid rgba(255, 255, 255, 0.4);
  
  width: 100%;
  max-width: 400px;
  border-radius: 24px;
  padding: 40px 30px;
  box-shadow: 0 10px 40px 0 rgba(31, 38, 135, 0.15);
}

.logo-area {
  margin-bottom: 40px;
}

/* 커스텀 로고 스타일 및 둥둥 떠다니는 애니메이션 */
.custom-app-logo {
  width: 85px;
  height: 85px;
  border-radius: 22px;
  margin-bottom: 15px;
  box-shadow: 0 6px 16px rgba(0,0,0,0.12);
  animation: float 6s ease-in-out infinite;
}

@keyframes float {
  0% { transform: translateY(0px); }
  50% { transform: translateY(-8px); }
  100% { transform: translateY(0px); }
}

.logo-area h1.glow-text {
  font-size: 1.6rem;
  color: #222;
  margin-bottom: 5px;
  font-weight: 800;
  text-shadow: 0 2px 4px rgba(255,255,255,0.6);
}

.logo-area p {
  font-size: 0.9rem;
}

.login-form {
  gap: 20px;
}

.input-group {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.input-group label {
  font-size: 0.85rem;
  font-weight: 600;
  color: var(--color-text-secondary);
}

.input-group input {
  padding: 14px 16px;
  border: 1px solid rgba(0,0,0,0.1);
  background: rgba(255,255,255,0.9);
  border-radius: 12px;
  font-size: 1rem;
  font-family: inherit;
  transition: all 0.3s ease;
  outline: none;
  box-shadow: inset 0 1px 3px rgba(0,0,0,0.02);
}

.input-group input:focus {
  background: #ffffff;
  border-color: var(--color-primary);
  box-shadow: 0 0 0 3px rgba(107, 78, 255, 0.15), 0 4px 10px rgba(0,0,0,0.05);
  transform: translateY(-1px);
}

.pwd-input-wrapper {
  position: relative;
  display: flex;
  align-items: center;
}

.pwd-input-wrapper input {
  width: 100%;
  padding-right: 40px; /* 눈모양 버튼 공간 확보 */
}

.eye-btn {
  position: absolute;
  right: 12px;
  background: none;
  border: none;
  font-size: 1.1rem;
  cursor: pointer;
  opacity: 0.6;
  padding: 4px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: opacity 0.2s;
}

.eye-btn:hover {
  opacity: 1;
}

.btn-primary {
  margin-top: 15px;
  padding: 16px;
  background: linear-gradient(135deg, var(--color-primary) 0%, #8b6ff9 100%);
  color: white;
  border: none;
  border-radius: 12px;
  font-size: 1.05rem;
  font-weight: 700;
  cursor: pointer;
  box-shadow: 0 4px 15px rgba(107, 78, 255, 0.3);
  transition: all 0.3s ease;
}

.btn-primary:active {
  transform: scale(0.97);
  box-shadow: 0 2px 8px rgba(107, 78, 255, 0.3);
}

.btn-primary:hover {
  transform: translateY(-2px);
  box-shadow: 0 6px 20px rgba(107, 78, 255, 0.4);
}

.btn-secondary {
  background: none;
  border: none;
  color: var(--color-primary);
  font-size: 0.9rem;
  font-weight: 600;
  cursor: pointer;
  padding: 10px;
  text-decoration: underline;
  transition: opacity 0.2s;
}

.btn-secondary:hover {
  opacity: 0.8;
}
</style>
