import * as React from "react"

import { cn } from "@/lib/utils"

/*
 * 与 input.tsx 同一处补丁，shadcn 重新生成后要再打一遍：字号收缩用 lg:text-sm。
 * md（768 px）到 lg（1024 px）之间仍是手机单栏，多行框在这一段掉到 14 px 一样会触发 iOS 聚焦缩放。
 * 调用点原先各自补 text-base md:text-base 兜这条，基类改对之后不再依赖调用点。
 */

function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        "flex field-sizing-content min-h-16 w-full rounded-lg border border-input bg-transparent px-2.5 py-2 text-base transition-colors outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:bg-input/50 disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 lg:text-sm dark:bg-input/30 dark:disabled:bg-input/80 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40",
        className
      )}
      {...props}
    />
  )
}

export { Textarea }
