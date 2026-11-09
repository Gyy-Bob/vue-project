<template>
  <div class="menu-page">
    <!-- 左侧侧边栏（设计稿第 3 页） -->
    <aside class="sidebar">
      <div class="logo">
        <span class="logo-mark"></span>
        <span>AURORA</span>
      </div>
      <div class="nav-item" :class="{ active: activeNav === 'home' }" @click="goHome">
        <span class="nav-icon">▦</span> 工作台
      </div>      <div class="nav-item" :class="{ active: activeNav === 'queue' }" @click="goQueue">
        <span class="nav-icon">✎</span> 文字导出
      </div>
      <div class="spacer"></div>
      <div class="user-chip">
        <div class="avatar">{{ avatarChar }}</div>
        <div>
          <div class="name">{{ userStore.userName }}</div>
          <div class="sub">已登录</div>
        </div>
      </div>
    </aside>

    <!-- 右侧主内容 -->
    <main class="menu-main">
      <div class="menu-topbar">
        <h2>工作台</h2>
        <button class="btn-logout" @click="handleLogout">退出登录</button>
      </div>

      <div class="banner">
        <h3>{{ greeting }}，{{ userStore.userName }}</h3>
        <p>欢迎使用注册人员信息查询系统</p>
      </div>

      <!-- 统计卡片：来自接口 summary -->
      <div class="stat-row">
        <div class="stat-card">
          <div class="label">注册总人数</div>
          <div class="value">{{ summary.total ?? '—' }}</div>
        </div>
        <div class="stat-card">
          <div class="label">今日新增</div>
          <div class="value gold">{{ summary.todayCount ?? '—' }}</div>
        </div>
        <div class="stat-card">
          <div class="label">禁用账号</div>
          <div class="value">{{ summary.disabledCount ?? '—' }}</div>
        </div>
      </div>

      <!-- 查询栏 -->
      <div class="search-bar">
        <div class="search-item">
          <label>账号搜索</label>
          <input
            v-model.trim="query.userName"
            class="input"
            type="text"
            placeholder="按账号模糊搜索"
            @keyup.enter="loadData(1)"
          />
        </div>
        <div class="search-item">
          <label>注册时间起</label>
          <input v-model="query.startDate" class="input" type="date" />
        </div>
        <div class="search-item">
          <label>注册时间止</label>
          <input v-model="query.endDate" class="input" type="date" />
        </div>
        <button class="btn-search" @click="loadData(1)">查 询</button>
        <button class="btn-reset" @click="resetQuery">重 置</button>
      </div>

      <!-- 用户列表 -->
      <div class="table-card">
        <table>
          <thead>
            <tr>
              <th>用户 ID</th>
              <th>账号</th>
              <th>年龄</th>
              <th>状态</th>
              <th>注册时间</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="u in list" :key="u.userId">
              <td>{{ u.userId }}</td>
              <td>{{ u.userName }}</td>
              <td>{{ u.userAge ?? '—' }}</td>
              <td>
                <span class="tag" :class="u.status === 1 ? 'ok' : 'off'">
                  {{ u.status === 1 ? '启用' : '禁用' }}
                </span>
              </td>
              <td>{{ u.createdAt }}</td>
            </tr>
            <tr v-if="!list.length && !loading">
              <td colspan="5">
                <div class="empty-state">
                  {{ loadError ? loadError : '暂无数据' }}
                  <div v-if="loadError" style="margin-top: 12px">
                    <button class="btn-reset" @click="loadData()">重新加载</button>
                  </div>
                </div>
              </td>
            </tr>
          </tbody>
        </table>

        <!-- 分页 -->
        <div v-if="pagination.total > 0" class="pagination">
          <span>共 {{ pagination.total }} 条 / {{ pagination.pages }} 页</span>
          <select v-model.number="query.pageSize" class="page-size-select" @change="loadData(1)">
            <option :value="10">10 条/页</option>
            <option :value="20">20 条/页</option>
            <option :value="50">50 条/页</option>
          </select>
          <button class="page-btn" :disabled="query.pageNum <= 1" @click="loadData(query.pageNum - 1)">‹</button>
          <button
            v-for="p in visiblePages"
            :key="p"
            class="page-btn"
            :class="{ current: p === query.pageNum }"
            @click="p !== '…' && loadData(p)"
          >
            {{ p }}
          </button>
          <button class="page-btn" :disabled="query.pageNum >= pagination.pages" @click="loadData(query.pageNum + 1)">›</button>
        </div>
      </div>

      <!-- 文字导出 Excel 功能 -->
      <TextQueueExport ref="queueFeatureRef" />
    </main>
  </div>
</template>

<script setup>
import { computed, onMounted, reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import { getReportUsers } from '@/api/auth'
import { useUserStore } from '@/stores/user'
import { toast } from '@/composables/toast'
import TextQueueExport from '@/components/TextQueueExport.vue'

const router = useRouter()
const userStore = useUserStore()

const queueFeatureRef = ref(null)
const activeNav = ref('home')

function goQueue() {
  activeNav.value = 'queue'
  queueFeatureRef.value?.$el?.scrollIntoView({ behavior: 'smooth', block: 'start' })
}

function goHome() {
  activeNav.value = 'home'
  document.querySelector('.menu-main')?.scrollTo({ top: 0, behavior: 'smooth' })
}

const summary = ref({})
const list = ref([])
const pagination = reactive({ total: 0, pages: 0 })
const loading = ref(false)
const loadError = ref('')

const query = reactive({
  pageNum: 1,
  pageSize: 10,
  userName: '',
  startDate: '',
  endDate: '',
})

const avatarChar = computed(() => (userStore.userName || 'A').slice(0, 1).toUpperCase())
const greeting = computed(() => {
  const h = new Date().getHours()
  if (h < 6) return '凌晨好'
  if (h < 12) return '上午好'
  if (h < 14) return '中午好'
  if (h < 18) return '下午好'
  return '晚上好'
})

// 简易分页条（首尾 + 省略号）
const visiblePages = computed(() => {
  const pages = pagination.pages
  const cur = query.pageNum
  if (pages <= 7) return Array.from({ length: pages }, (_, i) => i + 1)
  const set = new Set([1, pages, cur, cur - 1, cur + 1])
  const arr = [...set].filter((p) => p >= 1 && p <= pages).sort((a, b) => a - b)
  const out = []
  let prev = 0
  for (const p of arr) {
    if (p - prev > 1) out.push('…')
    out.push(p)
    prev = p
  }
  return out
})

async function loadData(pageNum) {
  if (pageNum) query.pageNum = pageNum
  loading.value = true
  loadError.value = ''
  try {
    const data = await getReportUsers({
      pageNum: query.pageNum,
      pageSize: query.pageSize,
      userName: query.userName || undefined,
      startDate: query.startDate || undefined,
      endDate: query.endDate || undefined,
    })
    summary.value = data.summary || {}
    list.value = data.list || []
    pagination.total = data.total || 0
    pagination.pages = data.pages || 0
  } catch (err) {
    // 40100 已在拦截器统一处理；这里处理 40002/40003/50000 等
    list.value = []
    loadError.value = err.message
    toast.error(err.message)
  } finally {
    loading.value = false
  }
}

function resetQuery() {
  query.userName = ''
  query.startDate = ''
  query.endDate = ''
  loadData(1)
}

function handleLogout() {
  userStore.logout()
  toast.info('已退出登录')
  router.push({ name: 'login' })
}

onMounted(() => {
  loadData(1)
})
</script>
