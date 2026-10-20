# 首次接入

安装 skill 后运行其 scripts/manage.mjs sync，进入返回的 workspace。需要 Node.js 20+ 和 Git，不需要统一 npm install，也不需要访问私有代码仓库。

本地验证：

```sh
node scripts/verify.mjs
node sketch/sketch.mjs save tasks/demo/draft sketch/examples/work-order.json 0
node sketch/sketch.mjs check tasks/demo/draft --discussion
node sketch/sketch.mjs render tasks/demo/draft
```

这是演示数据检查；真实任务从自己的需求组织，并通过 agent 迭代。预览文件为 tasks/demo/draft/预览.html。Mac 可以 open 打开，其他系统用浏览器打开该文件。

先交付草稿；需要 Figma 时阅读 figma-adapter.md。Figma 由 agent 引导完成工具检查、组件映射和验证；不让同事手动改配置。账号登录、目标选择可能需要本人确认，字体能力取决于实际环境。日志配置是可选项，见 support/README.md，不会自动上传到作者服务器。
