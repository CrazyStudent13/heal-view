import { defineConfig } from 'vitepress';

export default defineConfig({
  lang: 'zh-CN',
  title: 'Heal View',
  description: '运动健康数据可视化仪表板',
  cleanUrls: true,
  themeConfig: {
    logo: '/logo.svg',
    nav: [
      { text: '首页', link: '/' },
      { text: '使用指南', link: '/guide/features' },
      { text: '项目资料', link: '/project/overview' },
      { text: '版本记录', link: '/releases/current' },
      { text: '优化待办', link: '/todos/frontend-optimization' },
      { text: 'GitHub', link: 'https://github.com/CrazyStudent13/heal-view' }
    ],
    sidebar: {
      '/guide/': [
        {
          text: '使用指南',
          items: [
            { text: '项目功能', link: '/guide/features' },
            { text: '快速开始', link: '/guide/quick-start' },
            { text: '数据导入', link: '/guide/data-import' }
          ]
        }
      ],
      '/project/': [
        {
          text: '项目资料',
          items: [
            { text: '项目概览', link: '/project/overview' },
            { text: '技术栈', link: '/project/tech-stack' },
            { text: '系统架构', link: '/project/architecture' }
          ]
        }
      ],
      '/releases/': [
        {
          text: '版本记录',
          items: [
            { text: '当前版本', link: '/releases/current' },
            { text: '更新记录', link: '/releases/changelog' },
            { text: '未来计划', link: '/roadmap' }
          ]
        }
      ],
      '/todos/': [
        {
          text: '优化待办',
          items: [
            { text: '前端优化方向', link: '/todos/frontend-optimization' }
          ]
        }
      ],
      '/': [
        {
          text: '项目资料',
          items: [
            { text: '项目概览', link: '/project/overview' },
            { text: '技术栈', link: '/project/tech-stack' },
            { text: '系统架构', link: '/project/architecture' }
          ]
        },
        {
          text: '使用指南',
          items: [
            { text: '项目功能', link: '/guide/features' },
            { text: '快速开始', link: '/guide/quick-start' },
            { text: '数据导入', link: '/guide/data-import' }
          ]
        },
        { text: '未来计划', link: '/roadmap' },
        { text: '优化待办', link: '/todos/frontend-optimization' }
      ]
    },
    socialLinks: [{ icon: 'github', link: 'https://github.com/CrazyStudent13/heal-view' }],
    search: { provider: 'local' },
    footer: { message: 'Heal View 项目文档', copyright: 'Copyright © 2026 Heal View' }
  }
});
