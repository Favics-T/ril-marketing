import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"
const alertVariants = cva("relative flex w-full items-start gap-3 rounded-lg border px-4 py-3 text-sm leading-relaxed [&>svg]:mt-0.5 [&>svg]:size-4 [&>svg]:shrink-0", { variants: { variant: { default: "border-border bg-card text-card-foreground", destructive: "border-destructive/30 bg-card text-destructive" } }, defaultVariants: { variant: "default" } })
const Alert = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement> & VariantProps<typeof alertVariants> & { asChild?: boolean }>(({ className, variant, asChild, ...props }, ref) => {
  const Comp = asChild ? Slot : "div"
  return <Comp ref={ref} role="alert" data-slot="alert" className={cn(alertVariants({ variant }), className)} {...props} />
})
Alert.displayName = "Alert"
const AlertTitle = React.forwardRef<HTMLHeadingElement, React.HTMLAttributes<HTMLHeadingElement>>(({className, ...props}, ref) => <h5 ref={ref} data-slot="alert-title" className={cn("font-medium leading-snug", className)} {...props} />)
AlertTitle.displayName = "AlertTitle"
const AlertDescription = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(({className, ...props}, ref) => <div ref={ref} data-slot="alert-description" className={cn("text-sm leading-relaxed [&_p]:leading-relaxed", className)} {...props} />)
AlertDescription.displayName = "AlertDescription"
export { Alert, AlertTitle, AlertDescription }
