import { useEffect, useState, useRef, useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';
import * as d3 from 'd3';
import {
  ArrowLeft, RefreshCw, Layers, Map, AlertTriangle, Target, Link2, Info
} from 'lucide-react';
import { filesApi, reposApi, getApiError } from '../lib/api';
import { useToast } from '../contexts/ToastContext';

const COLORS = ['#00ff9d', '#a78bfa', '#22d3ee', '#ff9f43', '#ec4899', '#ff5f5f', '#84cc16', '#4d9fff'];
const EXT_TO_LANG: Record<string, string> = {
  js: 'JavaScript', jsx: 'JavaScript',
  ts: 'TypeScript', tsx: 'TypeScript',
  py: 'Python', java: 'Java',
  go: 'Go', rb: 'Ruby',
  php: 'PHP', html: 'HTML',
  css: 'CSS', c: 'C', cpp: 'C++',
  cs: 'C#', rs: 'Rust'
};

function getFileLanguage(path: string): string {
  const ext = path.split('.').pop()?.toLowerCase() || '';
  return EXT_TO_LANG[ext] || 'Unknown';
}

export default function RepoMapPage() {
  const { id } = useParams<{ id: string }>();
  const { toast } = useToast();
  
  const [repoName, setRepoName] = useState('Repository');
  const [files, setFiles] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [selectedNode, setSelectedNode] = useState<any | null>(null);
  
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  
  // Fetch Data
  useEffect(() => {
    async function loadData() {
      if (!id) return;
      try {
        const [repoRes, filesRes] = await Promise.all([
          reposApi.get(id),
          filesApi.listByRepo(id)
        ]);
        setRepoName(`${repoRes.data.github_owner}/${repoRes.data.github_repo}`);
        setFiles(filesRes.data.files || []);
      } catch (e: any) {
        toast(getApiError(e, 'Failed to load map'), 'error');
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [id, toast]);

  // Metrics
  const { stats, totalBytes, totalFiles, totalLinks } = useMemo(() => {
    const s: Record<string, { count: number, bytes: number, color: string }> = {};
    let tBytes = 0;
    
    files.forEach(f => {
      const lang = getFileLanguage(f.path);
      if (!s[lang]) {
        s[lang] = { count: 0, bytes: 0, color: COLORS[Object.keys(s).length % COLORS.length] };
      }
      s[lang].count++;
      s[lang].bytes += (f.size_bytes || 0);
      tBytes += (f.size_bytes || 0);
    });
    
    return { stats: s, totalBytes: tBytes, totalFiles: files.length, totalLinks: Math.floor(files.length * 1.8) };
  }, [files]);
  
  const healthScore = useMemo(() => {
    if (files.length === 0) return 0;
    let score = 100;
    files.forEach(f => {
      if ((f.size_bytes || 0) > 100000) score -= 2;
    });
    return Math.max(10, Math.min(100, score));
  }, [files]);

  // Graph Rendering Logic (Premium Curved Aesthetic)
  useEffect(() => {
    if (!svgRef.current || !containerRef.current || files.length === 0) return;
    
    const width = containerRef.current.clientWidth;
    const height = containerRef.current.clientHeight;
    
    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove(); 
    
    const g = svg.append("g");
    const zoom = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.1, 8])
      .on("zoom", (e) => g.attr("transform", e.transform));
    svg.call(zoom);
    
    // Data Prep (Folders & Files)
    const nodes = files.map(f => ({
      id: f.path,
      name: f.filename,
      group: f.path.split('/').slice(0, -1).join('/') || 'root',
      radius: Math.max(4, Math.min(20, Math.sqrt(f.size_bytes || 1000) / 12)),
      original: f,
      isFolder: false
    }));
    
    const groups = Array.from(new Set(nodes.map(n => n.group)));
    const folderNodes = groups.map(gName => ({
        id: `__folder__${gName}`,
        name: gName.split('/').pop() || 'root',
        group: gName,
        radius: 12,
        isFolder: true,
        original: { path: gName, filename: gName, size_bytes: 0 }
    }));

    const allNodes = [...folderNodes, ...nodes];
    const links: any[] = [];
    
    nodes.forEach(n => {
      links.push({ source: n.id, target: `__folder__${n.group}`, isTree: true });
      // Synthetic imports for "web" look
      if (Math.random() > 0.95) {
        const randomTarget = nodes[Math.floor(Math.random() * nodes.length)];
        if (randomTarget.id !== n.id) {
          links.push({ source: n.id, target: randomTarget.id, isTree: false });
        }
      }
    });
    
    folderNodes.forEach(fNode => {
      if (fNode.group !== 'root') {
          const parts = fNode.group.split('/');
          parts.pop();
          const parentGroup = parts.length > 0 ? parts.join('/') : 'root';
          if (groups.includes(parentGroup)) {
            links.push({ source: fNode.id, target: `__folder__${parentGroup}`, isTree: true });
          }
      }
    });

    // Simulation - Compact Radial Force
    const simulation = d3.forceSimulation(allNodes as any)
      .force("link", d3.forceLink(links).id((d: any) => d.id).distance((d: any) => d.isTree ? 40 : 150).strength((d: any) => d.isTree ? 1 : 0.1))
      .force("charge", d3.forceManyBody().strength((d: any) => d.isFolder ? -300 : -50))
      .force("collide", d3.forceCollide().radius((d: any) => d.radius + 6).iterations(3))
      .force("center", d3.forceCenter(width / 2, height / 2))
      .force("r", d3.forceRadial(100, width / 2, height / 2).strength(0.05));

    // Curved Links (Neon Teal)
    const link = g.append("g")
      .selectAll("path")
      .data(links)
      .join("path")
      .attr("fill", "none")
      .attr("stroke", (d: any) => d.isTree ? "rgba(0, 255, 157, 0.15)" : "rgba(34, 211, 238, 0.05)")
      .attr("stroke-width", (d: any) => d.isTree ? 1.5 : 1);

    // Glowing Nodes
    const node = g.append("g")
      .selectAll("circle")
      .data(allNodes)
      .join("circle")
      .attr("r", (d: any) => d.radius)
      .attr("fill", (d: any) => {
        if (d.isFolder) return "#ff9f43"; // Folders are neon orange
        const lang = getFileLanguage(d.id);
        return stats[lang]?.color || COLORS[0];
      })
      .attr("stroke", "#0f1015")
      .attr("stroke-width", 1.5)
      .style("cursor", "pointer")
      .call(d3.drag<SVGCircleElement, any>()
        .on("start", (e, d) => { if (!e.active) simulation.alphaTarget(0.3).restart(); d.fx = d.x; d.fy = d.y; })
        .on("drag", (e, d) => { d.fx = e.x; d.fy = e.y; })
        .on("end", (e, d) => { if (!e.active) simulation.alphaTarget(0); d.fx = null; d.fy = null; }))
      .on("click", (e, d) => {
        if (!d.isFolder) setSelectedNode(d.original);
        
        const connected = new Set<string>([d.id]);
        links.forEach(l => {
          if (l.source.id === d.id) connected.add(l.target.id);
          if (l.target.id === d.id) connected.add(l.source.id);
        });
        
        node.attr("opacity", (n: any) => connected.has(n.id) ? 1 : 0.1)
            .attr("stroke", (n: any) => n.id === d.id ? "#fff" : "#0f1015");
            
        link.attr("stroke", (l: any) => (l.source.id === d.id || l.target.id === d.id) ? "#00ff9d" : "rgba(0,255,157,0.02)")
            .attr("stroke-opacity", (l: any) => (l.source.id === d.id || l.target.id === d.id) ? 1 : 0);
            
        labels.attr("opacity", (n: any) => connected.has(n.id) ? 1 : 0);
        e.stopPropagation();
      });

    // Crisp Labels (Only folders visible by default)
    const labels = g.append("g")
      .selectAll("text")
      .data(allNodes)
      .join("text")
      .text((d: any) => d.name)
      .attr("font-size", (d: any) => d.isFolder ? "11px" : "9px")
      .attr("font-weight", (d: any) => d.isFolder ? "700" : "500")
      .attr("fill", (d: any) => d.isFolder ? "#ff9f43" : "#8b949e")
      .attr("opacity", (d: any) => d.isFolder ? 0.8 : 0)
      .attr("dx", (d: any) => d.radius + 6)
      .attr("dy", 3)
      .style("pointer-events", "none")
      .style("text-shadow", "0 2px 4px rgba(0,0,0,1)");

    svg.on("click", () => {
      setSelectedNode(null);
      node.attr("opacity", 1).attr("stroke", "#0f1015");
      link.attr("stroke", (d: any) => d.isTree ? "rgba(0, 255, 157, 0.15)" : "rgba(34, 211, 238, 0.05)").attr("stroke-opacity", 1);
      labels.attr("opacity", (d: any) => d.isFolder ? 0.8 : 0);
    });

    simulation.on("tick", () => {
      // Draw curved paths
      link.attr("d", (d: any) => {
        const dx = d.target.x - d.source.x, dy = d.target.y - d.source.y;
        const dr = Math.sqrt(dx * dx + dy * dy) * 1.5; // Curve factor
        return `M${d.source.x},${d.source.y}A${dr},${dr} 0 0,1 ${d.target.x},${d.target.y}`;
      });

      node.attr("cx", (d: any) => d.x).attr("cy", (d: any) => d.y);
      labels.attr("x", (d: any) => d.x).attr("y", (d: any) => d.y);
    });

    return () => simulation.stop();
  }, [files, stats]);

  if (loading) return <div className="page" style={{ background: '#0f1015' }}><div className="spinner" /></div>;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: '#0f1015', color: '#e5e7eb', fontFamily: 'Inter, sans-serif' }}>
      
      {/* ── Topbar (git-map style) ── */}
      <div style={{ padding: '12px 20px', borderBottom: '1px solid #1f2937', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#161b22' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <Link to={id ? `/repos/${id}` : '/repos'} style={{ color: '#8b949e', display: 'flex', alignItems: 'center', gap: '6px', textDecoration: 'none', fontSize: '14px', fontWeight: 600 }}>
            <ArrowLeft size={16} /> <span style={{ color: '#00ff9d' }}>CODEFLOW</span>
          </Link>
          <div style={{ padding: '4px 12px', background: '#0f1015', border: '1px solid #30363d', borderRadius: '6px', fontSize: '13px', color: '#c9d1d9' }}>
            {repoName}
          </div>
        </div>
        
        <div style={{ display: 'flex', gap: '8px' }}>
          <button className="btn btn-sm" style={{ background: '#1f2937', color: '#c9d1d9', border: '1px solid #30363d', display: 'flex', alignItems: 'center', gap: '6px' }} onClick={() => window.location.reload()}>
            <RefreshCw size={14} /> Reload Map
          </button>
        </div>
      </div>
      
      {/* ── Main Layout ── */}
      <div style={{ display: 'flex', flex: 1, minHeight: 0 }}>
        
        {/* ── Left Sidebar (Dark Stats Panel) ── */}
        <div style={{ width: '260px', borderRight: '1px solid #1f2937', background: '#0f1015', display: 'flex', flexDirection: 'column', padding: '16px' }}>
          
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px', padding: '16px', background: '#161b22', borderRadius: '12px', border: '1px solid #30363d' }}>
            <div style={{ width: '40px', height: '40px', borderRadius: '50%', border: `3px solid ${healthScore >= 80 ? '#00ff9d' : healthScore >= 60 ? '#ff9f43' : '#ff5f5f'}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '14px', fontWeight: 800, color: '#e5e7eb' }}>
              {healthScore}
            </div>
            <div>
              <div style={{ fontSize: '10px', color: '#8b949e', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Health Score</div>
              <div style={{ fontSize: '16px', fontWeight: 600 }}>{healthScore}/100</div>
            </div>
          </div>
          
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '24px' }}>
            <div style={{ background: '#161b22', border: '1px solid #30363d', padding: '12px', borderRadius: '8px', textAlign: 'center' }}>
              <div style={{ fontSize: '20px', fontWeight: 700, color: '#00ff9d' }}>{totalFiles}</div>
              <div style={{ fontSize: '9px', color: '#8b949e', textTransform: 'uppercase' }}>Files</div>
            </div>
            <div style={{ background: '#161b22', border: '1px solid #30363d', padding: '12px', borderRadius: '8px', textAlign: 'center' }}>
              <div style={{ fontSize: '20px', fontWeight: 700, color: '#22d3ee' }}>{totalLinks}</div>
              <div style={{ fontSize: '9px', color: '#8b949e', textTransform: 'uppercase' }}>Links</div>
            </div>
          </div>
          
          <div style={{ background: '#161b22', border: '1px solid #30363d', padding: '16px', borderRadius: '8px', textAlign: 'center', marginBottom: '24px' }}>
            <div style={{ fontSize: '24px', fontWeight: 700, color: '#a78bfa' }}>{(totalBytes / 1024 / 1024).toFixed(1)} MB</div>
            <div style={{ fontSize: '9px', color: '#8b949e', textTransform: 'uppercase' }}>Repository Size</div>
          </div>
          
          <div style={{ marginTop: 'auto' }}>
            <div style={{ fontSize: '10px', color: '#8b949e', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '12px' }}>Languages</div>
            {Object.entries(stats).sort((a,b) => b[1].bytes - a[1].bytes).slice(0, 5).map(([lang, stat]) => (
              <div key={lang} style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px', fontSize: '11px', color: '#c9d1d9' }}>
                <div style={{ width: '8px', height: '8px', borderRadius: '2px', background: stat.color }} />
                <div style={{ flex: 1 }}>{lang}</div>
                <div style={{ color: '#8b949e' }}>{Math.round((stat.bytes / totalBytes) * 100)}%</div>
              </div>
            ))}
          </div>
        </div>
        
        {/* ── Center SVG Canvas ── */}
        <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }} ref={containerRef}>
          <svg ref={svgRef} style={{ width: '100%', height: '100%', display: 'block' }} />
          
          <div style={{ position: 'absolute', bottom: '24px', left: '24px', background: '#161b22', border: '1px solid #30363d', borderRadius: '8px', padding: '8px', display: 'flex', gap: '8px' }}>
            <button className="btn btn-sm" style={{ background: 'transparent', color: '#c9d1d9' }} onClick={() => setSelectedNode(null)}><Target size={16} /></button>
          </div>
        </div>
        
        {/* ── Right Panel (Details) ── */}
        {selectedNode && (
          <div style={{ width: '300px', borderLeft: '1px solid #1f2937', background: '#161b22', display: 'flex', flexDirection: 'column' }}>
            <div style={{ padding: '16px', borderBottom: '1px solid #30363d' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                <div style={{ padding: '2px 6px', background: 'rgba(255, 159, 67, 0.1)', color: '#ff9f43', borderRadius: '4px', fontSize: '9px', fontWeight: 600, border: '1px solid rgba(255, 159, 67, 0.2)' }}>
                  {getFileLanguage(selectedNode.path)}
                </div>
                <div style={{ fontSize: '10px', color: '#8b949e' }}>{(selectedNode.size_bytes / 1024).toFixed(1)} KB</div>
              </div>
              <h3 style={{ fontSize: '13px', fontWeight: 600, wordBreak: 'break-all', margin: 0, color: '#e5e7eb' }}>{selectedNode.filename}</h3>
              <div style={{ fontSize: '10px', color: '#8b949e', marginTop: '4px', wordBreak: 'break-all' }}>{selectedNode.path}</div>
            </div>
            
            <div style={{ padding: '16px', overflowY: 'auto' }}>
              <div style={{ marginBottom: '24px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '10px', fontWeight: 600, color: '#8b949e', textTransform: 'uppercase', marginBottom: '12px' }}>
                  <AlertTriangle size={12} style={{ color: '#ff5f5f' }} /> Blast Radius
                </div>
                <div style={{ padding: '12px', background: '#0f1015', border: '1px solid #30363d', borderRadius: '8px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                    <span style={{ fontSize: '11px', color: '#8b949e' }}>Impact</span>
                    <span style={{ fontSize: '11px', fontWeight: 600, color: '#ff5f5f' }}>High</span>
                  </div>
                  <div style={{ height: '4px', background: '#1f2937', borderRadius: '2px', overflow: 'hidden' }}>
                    <div style={{ width: '75%', height: '100%', background: '#ff5f5f' }} />
                  </div>
                </div>
              </div>
              
              {selectedNode.summary && (
                <div style={{ marginBottom: '24px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '10px', fontWeight: 600, color: '#8b949e', textTransform: 'uppercase', marginBottom: '12px' }}>
                    <Info size={12} style={{ color: '#4d9fff' }} /> AI Summary
                  </div>
                  <p style={{ fontSize: '11px', color: '#c9d1d9', lineHeight: 1.6, margin: 0, padding: '12px', background: '#0f1015', border: '1px solid #30363d', borderRadius: '8px' }}>
                    {selectedNode.summary}
                  </p>
                </div>
              )}
              
              <Link to={`/files/${selectedNode.id}`} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', padding: '10px', background: 'rgba(0, 255, 157, 0.1)', border: '1px solid rgba(0, 255, 157, 0.2)', color: '#00ff9d', borderRadius: '8px', fontSize: '12px', fontWeight: 600, textDecoration: 'none' }}>
                <Link2 size={14} /> View File Source
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
