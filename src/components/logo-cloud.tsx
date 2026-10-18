import Image from "next/image";

export function LogoCloud() {
	return (
		<div className="relative flex flex-wrap items-center justify-center gap-x-10 gap-y-8 py-6 sm:gap-x-12 sm:gap-y-12">
			{logos.map((logo) => (
				<Image
					alt={logo.alt}
					className="pointer-events-none h-5 w-auto select-none dark:brightness-0 dark:invert"
					height={logo.height}
					key={logo.alt}
					loading="lazy"
					src={logo.src}
					width={logo.width}
					unoptimized
				/>
			))}
		</div>
	);
}

const logos = [
	{
		src: "https://storage.efferd.com/logo/vercel-wordmark.svg",
		alt: "Vercel Logo",
		width: 262, height: 52,
	},
	{
		src: "https://storage.efferd.com/logo/supabase-wordmark.svg",
		alt: "Supabase Logo",
		width: 581, height: 113,
	},
	{
		src: "https://storage.efferd.com/logo/openai-wordmark.svg",
		alt: "OpenAI Logo",
		width: 1180, height: 320,
	},
	{
		src: "https://storage.efferd.com/logo/dub-wordmark.svg",
		alt: "Dub Logo",
		width: 46, height: 24,
	},
	{
		src: "https://storage.efferd.com/logo/turso-wordmark.svg",
		alt: "Turso Logo",
		width: 740, height: 170,
	},

	{
		src: "https://storage.efferd.com/logo/github-wordmark.svg",
		alt: "GitHub Logo",
		width: 2491, height: 675,
	},
	{
		src: "https://storage.efferd.com/logo/claude-wordmark.svg",
		alt: "Claude AI Logo",
		width: 512, height: 110,
	},
	{
		src: "https://storage.efferd.com/logo/nvidia-wordmark.svg",
		alt: "Nvidia Logo",
		width: 164, height: 30,
	},
	{
		src: "https://storage.efferd.com/logo/clerk-wordmark.svg",
		alt: "Clerk Logo",
		width: 441, height: 128,
	},
	{
		src: "https://storage.efferd.com/logo/bolt-wordmark.svg",
		alt: "Bolt Logo",
		width: 1600, height: 687,
	},

	{
		src: "https://storage.efferd.com/logo/stripe-wordmark.svg",
		alt: "Stripe Logo",
		width: 512, height: 214,
	},
];
