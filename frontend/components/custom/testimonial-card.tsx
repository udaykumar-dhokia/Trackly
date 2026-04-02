import { motion } from "framer-motion";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import { Twitter, Verified, truncate } from "@/components/ui/tweet-card";

export function TestimonialCard({
  name,
  photo,
  content,
  className,
}: {
  name: string;
  photo?: string;
  content: string;
  className?: string;
}) {
  const displayName = name.includes("@")
    ? name.split("@")[0].charAt(0).toUpperCase() + name.split("@")[0].slice(1)
    : name;
  const handle = displayName.toLowerCase().replace(/\s+/g, "");

  return (
    <motion.div
      whileHover={{ y: -5, scale: 1.01 }}
      transition={{ duration: 0.3, ease: "easeOut" }}
      className={cn(
        "relative flex h-fit w-full max-w-lg flex-col gap-4 overflow-hidden rounded-xl border p-5 bg-background shadow-sm hover:border-primary/30 hover:shadow-xl hover:shadow-primary/5 transition-colors duration-300",
        className,
      )}
    >
      <div className="flex flex-row items-start justify-between tracking-normal">
        <div className="flex items-center space-x-3">
          <div className="shrink-0">
            <Avatar className="size-12 border border-border/50 overflow-hidden rounded-full">
              <AvatarImage src={photo} alt={displayName} />
              <AvatarFallback className="bg-primary/10 text-primary font-bold uppercase">
                {displayName?.[0] || "U"}
              </AvatarFallback>
            </Avatar>
          </div>
          <div className="flex flex-col gap-0.5">
            <div className="text-foreground flex items-center font-medium whitespace-nowrap transition-opacity hover:opacity-80">
              {truncate(displayName, 20)}
              <Verified className="ml-1 inline size-4 text-blue-500" />
            </div>
            <div className="flex items-center space-x-1">
              <span className="text-muted-foreground text-sm">
                @{truncate(handle, 16)}
              </span>
            </div>
          </div>
        </div>
        <Twitter className="text-muted-foreground size-5 items-start" />
      </div>
      <div className="text-[15px] leading-relaxed tracking-normal text-foreground">
        <p>{content}</p>
      </div>
    </motion.div>
  );
}
