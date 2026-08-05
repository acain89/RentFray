# Page snapshot

```yaml
- generic [active] [ref=e1]:
  - main [ref=e2]:
    - generic [ref=e4]:
      - generic [ref=e5]:
        - heading "Manager Login" [level=1] [ref=e6]
        - paragraph [ref=e7]: Enter your email and password.
      - generic [ref=e8]:
        - generic [ref=e9]:
          - generic [ref=e10]: Email
          - textbox "manager@test.com" [ref=e11]: your-manager@email.com
        - generic [ref=e12]:
          - generic [ref=e13]: Password
          - textbox "••••••••" [ref=e14]: your-manager-password
        - button "Signing in..." [disabled] [ref=e15]
  - button "Open Next.js Dev Tools" [ref=e21] [cursor=pointer]:
    - generic [ref=e24]:
      - text: Compiling
      - generic [ref=e25]:
        - generic [ref=e26]: .
        - generic [ref=e27]: .
        - generic [ref=e28]: .
  - alert [ref=e29]
```