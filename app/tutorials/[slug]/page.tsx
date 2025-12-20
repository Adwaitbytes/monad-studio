"use client";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";

export default function TutorialPage() {
  const params = useParams();
  const slug = params.slug as string;
  const [content, setContent] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadTutorial();
  }, [slug]);

  const loadTutorial = async () => {
    try {
      const res = await fetch(`/api/tutorial?slug=${slug}`);
      const data = await res.json();
      if (data.success) {
        setContent(data.content);
      } else {
        setContent("# Tutorial Not Found\n\nThe requested tutorial could not be loaded.");
      }
    } catch (err) {
      setContent("# Error\n\nFailed to load tutorial.");
    } finally {
      setLoading(false);
    }
  };

  // Simple markdown-to-HTML converter for basic formatting
  const renderMarkdown = (md: string) => {
    return md
      .split('\n')
      .map((line, i) => {
        // Headers
        if (line.startsWith('### ')) {
          return <h3 key={i} className="text-xl font-bold mt-6 mb-3 text-purple-400">{line.slice(4)}</h3>;
        }
        if (line.startsWith('## ')) {
          return <h2 key={i} className="text-2xl font-bold mt-8 mb-4 text-purple-300">{line.slice(3)}</h2>;
        }
        if (line.startsWith('# ')) {
          return <h1 key={i} className="text-4xl font-bold mb-6 text-white">{line.slice(2)}</h1>;
        }
        
        // Code blocks
        if (line.startsWith('```')) {
          return null; // Handle in separate pass
        }
        
        // Bold
        const boldProcessed = line.replace(/\*\*(.+?)\*\*/g, '<strong class="font-bold text-white">$1</strong>');
        
        // Inline code
        const codeProcessed = boldProcessed.replace(/`(.+?)`/g, '<code class="bg-purple-500/20 text-purple-300 px-2 py-0.5 rounded text-sm font-mono">$1</code>');
        
        // Empty line
        if (!line.trim()) {
          return <br key={i} />;
        }
        
        // Regular paragraph
        return <p key={i} className="text-gray-300 leading-relaxed mb-3" dangerouslySetInnerHTML={{ __html: codeProcessed }} />;
      });
  };

  const processContent = () => {
    const lines = content.split('\n');
    const elements: React.ReactElement[] = [];
    let inCodeBlock = false;
    let codeBlockContent: string[] = [];
    let codeBlockLang = '';

    lines.forEach((line, i) => {
      if (line.startsWith('```')) {
        if (!inCodeBlock) {
          inCodeBlock = true;
          codeBlockLang = line.slice(3);
          codeBlockContent = [];
        } else {
          inCodeBlock = false;
          elements.push(
            <pre key={`code-${i}`} className="bg-black/50 border border-white/10 rounded-lg p-4 overflow-x-auto my-4">
              <code className="text-sm font-mono text-gray-300">{codeBlockContent.join('\n')}</code>
            </pre>
          );
          codeBlockContent = [];
        }
        return;
      }

      if (inCodeBlock) {
        codeBlockContent.push(line);
        return;
      }

      // Headers
      if (line.startsWith('### ')) {
        elements.push(<h3 key={i} className="text-xl font-bold mt-6 mb-3 text-purple-400">{line.slice(4)}</h3>);
      } else if (line.startsWith('## ')) {
        elements.push(<h2 key={i} className="text-2xl font-bold mt-8 mb-4 text-purple-300">{line.slice(3)}</h2>);
      } else if (line.startsWith('# ')) {
        elements.push(<h1 key={i} className="text-4xl font-bold mb-6 text-white">{line.slice(2)}</h1>);
      } else if (line.startsWith('- ') || line.startsWith('* ')) {
        // List items
        const text = line.slice(2);
        const processed = text
          .replace(/\*\*(.+?)\*\*/g, '<strong class="font-bold text-white">$1</strong>')
          .replace(/`(.+?)`/g, '<code class="bg-purple-500/20 text-purple-300 px-1 py-0.5 rounded text-sm font-mono">$1</code>');
        elements.push(
          <li key={i} className="text-gray-300 ml-6 mb-2" dangerouslySetInnerHTML={{ __html: `• ${processed}` }} />
        );
      } else if (!line.trim()) {
        elements.push(<br key={i} />);
      } else {
        // Regular paragraph
        const processed = line
          .replace(/\*\*(.+?)\*\*/g, '<strong class="font-bold text-white">$1</strong>')
          .replace(/`(.+?)`/g, '<code class="bg-purple-500/20 text-purple-300 px-2 py-0.5 rounded text-sm font-mono">$1</code>');
        elements.push(<p key={i} className="text-gray-300 leading-relaxed mb-3" dangerouslySetInnerHTML={{ __html: processed }} />);
      }
    });

    return elements;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#080808] text-white flex items-center justify-center">
        <div className="animate-pulse text-gray-400">Loading tutorial...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#080808] text-white">
      {/* Background */}
      <div className="fixed inset-0 pointer-events-none z-0"
        style={{ backgroundImage: 'radial-gradient(rgba(255,255,255,0.1) 1px, transparent 1px)', backgroundSize: '24px 24px' }}>
      </div>
      <div className="fixed top-0 left-1/2 -translate-x-1/2 w-[600px] h-[300px] bg-purple-600/20 blur-[120px] rounded-full pointer-events-none z-0"></div>

      {/* Content */}
      <div className="relative z-10 max-w-4xl mx-auto px-6 py-12">
        <Link href="/" className="inline-flex items-center gap-2 text-purple-400 hover:text-purple-300 mb-8 text-sm font-bold">
          ← Back to SomniStudio
        </Link>

        <div className="bg-[#111] border border-white/5 rounded-3xl p-8 md:p-12">
          {processContent()}
        </div>

        <div className="mt-8 text-center">
          <Link href="/" className="inline-block px-6 py-3 bg-purple-600 hover:bg-purple-500 rounded-lg text-sm font-bold transition-all">
            Try in SomniStudio
          </Link>
        </div>
      </div>
    </div>
  );
}
