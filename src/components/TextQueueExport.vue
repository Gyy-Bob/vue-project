<template>
  <div class="table-card queue-feature">
    <div class="queue-head">
      <h3>✎ 文字导出 Excel</h3>
      <span class="queue-hint">输入文字加入队列，右侧实时展示，可随时修改，一键导出 Excel</span>
    </div>

    <div class="queue-layout">
      <!-- 左侧：输入区 -->
      <div class="queue-input-area">
        <div class="input-wrap">
          <i class="icon">✎</i>
          <input
            v-model="draft"
            class="input"
            type="text"
            placeholder="请输入文字，回车或点击确认加入队列"
            maxlength="200"
            @keyup.enter="confirmAdd"
          />
        </div>
        <div class="queue-btn-row">
          <button class="btn-gold queue-btn" @click="confirmAdd">确认加入</button>
          <button class="btn-export" :disabled="!queue.length" @click="exportExcel">
            ⇩ 导出 Excel
          </button>
        </div>
        <div class="queue-tip">已加入 {{ queue.length }} 条 / 单条最长 200 字</div>
      </div>

      <!-- 右侧：队列纵向展示区 -->
      <div class="queue-list" ref="listRef">
        <div v-if="!queue.length" class="empty-state">队列为空，在左侧输入文字并确认后加入</div>
        <div v-for="(item, i) in queue" :key="item.id" class="queue-item">
          <span class="q-index">{{ i + 1 }}</span>
          <template v-if="editingId === item.id">
            <input
              ref="editInputRef"
              v-model="editingText"
              class="input q-edit"
              maxlength="200"
              @keyup.enter="saveEdit(item.id)"
              @keyup.esc="cancelEdit"
            />
            <button class="q-btn q-save" @click="saveEdit(item.id)">保存</button>
            <button class="q-btn" @click="cancelEdit">取消</button>
          </template>
          <template v-else>
            <span class="q-text" :title="item.text">{{ item.text }}</span>
            <button class="q-btn" @click="startEdit(item)">编辑</button>
            <button class="q-btn q-del" @click="removeItem(item.id)">删除</button>
          </template>
        </div>
        <div v-if="queue.length" class="queue-count">共 {{ queue.length }} 条</div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { nextTick, ref } from 'vue'
import ExcelJS from 'exceljs'
import { toast } from '@/composables/toast'

const draft = ref('')
const queue = ref([])
const editingId = ref(null)
const editingText = ref('')
const listRef = ref(null)
const editInputRef = ref(null)

// 确认 / 回车：把文字加入队列
function confirmAdd() {
  const text = draft.value.trim()
  if (!text) {
    toast.warning('请输入文字内容')
    return
  }
  queue.value.push({ id: Date.now() + Math.random(), text })
  draft.value = ''
  toast.success('已加入队列')
  // 新条目自动滚到可见位置
  nextTick(() => {
    listRef.value?.scrollTo({ top: listRef.value.scrollHeight, behavior: 'smooth' })
  })
}

function startEdit(item) {
  editingId.value = item.id
  editingText.value = item.text
  nextTick(() => editInputRef.value?.[0]?.focus())
}

function saveEdit(id) {
  const text = editingText.value.trim()
  if (!text) {
    toast.warning('内容不能为空')
    return
  }
  const item = queue.value.find((q) => q.id === id)
  if (item) item.text = text
  editingId.value = null
  toast.success('已修改')
}

function cancelEdit() {
  editingId.value = null
}

function removeItem(id) {
  queue.value = queue.value.filter((q) => q.id !== id)
  toast.info('已删除')
}

// 导出 Excel：队列内容 → xlsx 自动下载
async function exportExcel() {
  if (!queue.value.length) {
    toast.warning('队列是空的，先添加文字再导出')
    return
  }
  const wb = new ExcelJS.Workbook()
  const ws = wb.addWorksheet('文字队列')
  ws.columns = [
    { header: '序号', key: 'idx', width: 8 },
    { header: '文字内容', key: 'text', width: 60 },
  ]
  // 表头按主题金色样式
  const head = ws.getRow(1)
  head.font = { bold: true, color: { argb: 'FF3A2C10' }, size: 12 }
  head.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD9A860' } }
  head.alignment = { vertical: 'middle', horizontal: 'center' }
  head.height = 22

  queue.value.forEach((item, i) => {
    ws.addRow({ idx: i + 1, text: item.text })
  })

  const buffer = await wb.xlsx.writeBuffer()
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `文字队列_${formatNow()}.xlsx`
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
  toast.success(`Excel 已生成（${queue.value.length} 条），开始下载`)
}

function formatNow() {
  const d = new Date()
  const p = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}_${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`
}
</script>
