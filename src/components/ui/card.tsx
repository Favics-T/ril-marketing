import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cn } from "@/lib/utils"

type CardProps = React.HTMLAttributes<HTMLDivElement> & { asChild?: boolean }
const Card = React.forwardRef<HTMLDivElement, CardProps>(({ className, asChild, ...props }, ref) => {
  const Comp = asChild ? Slot : "div"
  return <Comp ref={ref} data-slot="card" className={cn("min-w-0 rounded-xl border bg-card text-card-foreground shadow-sm", className)} {...props} />
})
Card.displayName = "Card"
const CardHeader = React.forwardRef<HTMLDivElement, CardProps>(({ className, asChild, ...props }, ref) => {
  const Comp = asChild ? Slot : "div"
  return <Comp ref={ref} data-slot="card-header" className={cn("flex flex-col gap-1.5 p-6", className)} {...props} />
})
CardHeader.displayName = "CardHeader"
const CardTitle = React.forwardRef<HTMLDivElement, CardProps>(({ className, asChild, ...props }, ref) => {
  const Comp = asChild ? Slot : "div"
  return <Comp ref={ref} data-slot="card-title" className={cn("font-semibold leading-snug tracking-tight", className)} {...props} />
})
CardTitle.displayName = "CardTitle"
const CardDescription = React.forwardRef<HTMLDivElement, CardProps>(({ className, asChild, ...props }, ref) => {
  const Comp = asChild ? Slot : "div"
  return <Comp ref={ref} data-slot="card-description" className={cn("text-sm text-muted-foreground", className)} {...props} />
})
CardDescription.displayName = "CardDescription"
const CardContent = React.forwardRef<HTMLDivElement, CardProps>(({ className, asChild, ...props }, ref) => {
  const Comp = asChild ? Slot : "div"
  return <Comp ref={ref} data-slot="card-content" className={cn("p-6 pt-0", className)} {...props} />
})
CardContent.displayName = "CardContent"
const CardFooter = React.forwardRef<HTMLDivElement, CardProps>(({ className, asChild, ...props }, ref) => {
  const Comp = asChild ? Slot : "div"
  return <Comp ref={ref} data-slot="card-footer" className={cn("flex items-center gap-2 p-6 pt-0", className)} {...props} />
})
CardFooter.displayName = "CardFooter"
export { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter }
