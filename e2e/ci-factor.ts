/**
 * CI 的超时系数，playwright.config.ts 与 e2e/helpers.ts 共用这一份。
 *
 * GitHub 的 runner 是 2 vCPU 跑 2 worker，两路 SwiftShader 上下文加 2048² 合成，
 * 实测比本机慢约六倍，所有预算在 CI 上统一乘一档。
 */
export const CI_FACTOR = process.env.CI ? 3 : 1
