import { createRouter, createWebHashHistory } from 'vue-router'
import { findTool } from '../config/tools'

const router = createRouter({
  history: createWebHashHistory(),
  scrollBehavior: () => ({ top: 0 }),
  routes: [
    { path: '/', name: 'home', component: () => import('../views/HomeView.vue') },
    { path: '/password', component: () => import('../views/PasswordView.vue') },
    { path: '/date-calculator', component: () => import('../views/DateCalculatorView.vue') },
    { path: '/random-port', component: () => import('../views/RandomPortView.vue') },
    { path: '/random-ip', component: () => import('../views/RandomIpView.vue') },
    { path: '/cidr-calculator', component: () => import('../views/CidrCalculatorView.vue') },
    { path: '/timestamp', component: () => import('../views/TimestampView.vue') },
    { path: '/ip-info', component: () => import('../views/IpInfoView.vue') },
    { path: '/text-encoding', component: () => import('../views/TextEncodingView.vue') },
    { path: '/nmap-generator', component: () => import('../views/NmapGeneratorView.vue') },
    { path: '/iperf3-generator', component: () => import('../views/Iperf3GeneratorView.vue') },
    { path: '/tcpdump-generator', component: () => import('../views/TcpdumpGeneratorView.vue') },
    { path: '/:pathMatch(.*)*', redirect: '/' },
  ],
})

router.afterEach((to) => {
  const title = to.path === '/' ? 'LittleTools · 浏览器工具箱' : `${findTool(to.path)?.name || '在线工具'} · LittleTools`
  document.title = title
})

export default router
