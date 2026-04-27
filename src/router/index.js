import { createRouter, createWebHistory } from 'vue-router'
import ChatList from '../views/ChatList.vue'

const routes = [
  {
    path: '/',
    name: 'Login',
    component: () => import('../views/LoginView.vue')
  },
  {
    path: '/chats',
    name: 'ChatList',
    component: ChatList
  },
  {
    path: '/chat/:id',
    name: 'ChatRoom',
    component: () => import('../views/ChatRoom.vue'),
    props: true
  },
  {
    path: '/calendar',
    name: 'CalendarView',
    component: () => import('../views/CalendarView.vue')
  }
]

const router = createRouter({
  history: createWebHistory(),
  routes
})

router.beforeEach((to, from, next) => {
  const familyCode = localStorage.getItem('family_code')
  
  if (to.name !== 'Login' && !familyCode) {
    next({ name: 'Login' })
  } else if (to.name === 'Login' && familyCode) {
    next({ name: 'ChatList' })
  } else {
    next()
  }
})

export default router
