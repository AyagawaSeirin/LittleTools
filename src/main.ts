import { createApp } from 'vue'
import Antd from 'ant-design-vue'
import 'dayjs/locale/zh-cn'
import dayjs from 'dayjs'
import 'ant-design-vue/dist/reset.css'
import './styles/global.css'
import App from './App.vue'
import router from './router'

dayjs.locale('zh-cn')
createApp(App).use(router).use(Antd).mount('#app')
