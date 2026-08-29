import * as React from "react"
import { Input as InputPrimitive } from "@base-ui/react/input"

import { cn } from "@/lib/utils"

/*
 * 本仓在 shadcn 生成的基类上打了一处补丁，重新生成后要再打一遍：
 * 字号收缩用 lg:text-sm 而不是原来的 md:text-sm。
 * 页面双栏布局的断点是 lg（1024 px），768 到 1023 px 仍是手机单栏，
 * 输入框在这一段必须留在 16 px，否则 iOS 聚焦时会把整页放大。
 * src/index.css 的 input{font-size:max(16px,1rem)} 在 base 层，压不过 utilities 层的字号类，兜不住这条。
 */

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <InputPrimitive
      type={type}
      data-slot="input"
      className={cn(
        "h-8 w-full min-w-0 rounded-lg border border-input bg-transparent px-2.5 py-1 text-base transition-colors outline-none file:inline-flex file:h-6 file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:cursor-not-allowed disabled:bg-input/50 disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 lg:text-sm dark:bg-input/30 dark:disabled:bg-input/80 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40",
        className
      )}
      {...props}
    />
  )
}

export { Input }
