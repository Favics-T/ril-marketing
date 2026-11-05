import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { Separator } from "@/components/ui/separator";

export function RichText({ children }: { children: string }) {
  return <div className="rich-text">
    <ReactMarkdown remarkPlugins={[remarkGfm]} skipHtml components={{
      h1: ({ children }) => <h3 className="rich-text-title">{children}</h3>,
      h2: ({ children }) => <h3>{children}</h3>,
      h3: ({ children }) => <h4>{children}</h4>,
      h4: ({ children }) => <h5>{children}</h5>,
      h5: ({ children }) => <h6>{children}</h6>,
      h6: ({ children }) => <h6>{children}</h6>,
      a: ({ href, children }) => <a href={href} rel="noopener noreferrer">{children}</a>,
      img: ({ alt }) => <span>{alt}</span>,
      table: ({ children }) => <Table>{children}</Table>,
      thead: ({ children }) => <TableHeader>{children}</TableHeader>,
      tbody: ({ children }) => <TableBody>{children}</TableBody>,
      tr: ({ children }) => <TableRow>{children}</TableRow>,
      th: ({ children }) => <TableHead>{children}</TableHead>,
      td: ({ children }) => <TableCell>{children}</TableCell>,
      hr: () => <Separator />,
    }}>{children}</ReactMarkdown>
  </div>;
}
