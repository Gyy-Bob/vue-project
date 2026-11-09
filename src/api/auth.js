import request from './request'

/**
 * 业务 1：用户注册（公开接口）
 * data: { userName, password, userAge?, userNote? }
 * 成功返回 data: { userId, userName, createdAt }
 */
export function register(data) {
  return request.post('/auth/register', data)
}

/**
 * 业务 2：用户登录（公开接口）
 * data: { userName, password }
 * 成功返回 data: { token, expiresIn, userId, userName }
 */
export function login(data) {
  return request.post('/auth/login', data)
}

/**
 * 业务 3：报表 - 查询注册人员（需 JWT）
 * params: { pageNum?, pageSize?, userName?, startDate?, endDate? }
 * 成功返回 data: { summary: {total, todayCount, disabledCount}, list: [...], pageNum, pageSize, total, pages }
 */
export function getReportUsers(params) {
  return request.get('/report/users', { params })
}
