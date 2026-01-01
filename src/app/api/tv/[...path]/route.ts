import { NextResponse } from 'next/server';

const INTERNAL_BASE = process.env.TV_INTERNAL || 'http://192.168.191.168:6789';

async function proxy(req: Request, params?: Promise<{ path?: string[] }> | { path?: string[] }) {
    try {
        // params 在最新 Next.js 中可能是 Promise，需要先 await
        const resolvedParams = await Promise.resolve(params || {} as { path?: string[] });
        const path = (resolvedParams.path || []).join('/') || '';
        const url = new URL(INTERNAL_BASE.replace(/\/+$/, '') + '/' + path);
        const incomingUrl = new URL(req.url);
        // 防止代理配置错误导致请求被代理回自身（代理循环）。
        // 比较 hostname（忽略端口），更稳健地避免端口差异导致的误判。
        try {
            if (url.hostname === incomingUrl.hostname) {
                return new NextResponse('Proxy loop detected: upstream target equals current host', { status: 500 });
            }
        } catch (e) {
            // ignore
        }
        incomingUrl.searchParams.forEach((v, k) => url.searchParams.append(k, v));

        // 转发请求头，排除 Host 等不应转发的 hop-by-hop 头
        const forwardHeaders = new Headers();
        for (const [k, v] of req.headers) {
            const lk = k.toLowerCase();
            if (lk === 'host') continue;
            forwardHeaders.set(k, v as string);
        }

        // 构造 fetch init，非 GET/HEAD 的请求保留 body（支持流式上传）
        const init: any = {
            method: req.method,
            headers: forwardHeaders,
            redirect: 'manual',
        };

        if (!['GET', 'HEAD'].includes(req.method)) {
            // 保持请求体的流式传输，若运行环境支持则设置 duplex
            init.body = req.body;
            try { init.duplex = 'half'; } catch (e) { /* ignore if not supported */ }
        }

        // 直接把请求 proxy 到内网服务（保持 upstream.body 为可读流）
        const upstream = await fetch(url.toString(), init);

        // 透传响应头，剔除 hop-by-hop 头
        const resHeaders = new Headers();
        upstream.headers.forEach((v, k) => {
            const lk = k.toLowerCase();
            if (['connection', 'keep-alive', 'transfer-encoding', 'upgrade', 'proxy-authenticate', 'proxy-authorization'].includes(lk)) return;
            resHeaders.set(k, v);
        });

        // 如果是 SSE，确保禁用缓存（有助于浏览器端即时接收）
        const ct = upstream.headers.get('content-type') || '';
        if (ct.includes('text/event-stream')) {
            resHeaders.set('cache-control', 'no-cache');
        }

        // upstream.body 是一个可读流，直接返回以实现流式转发（避免在服务端全部缓冲）
        return new NextResponse(upstream.body, { status: upstream.status, headers: resHeaders });
    } catch (err) {
        return new NextResponse(String(err), { status: 500 });
    }
}

export async function GET(req: Request, { params }: { params?: { path?: string[] } } = {}) {
    return proxy(req, params || {});
}
export async function POST(req: Request, { params }: { params?: { path?: string[] } } = {}) {
    return proxy(req, params || {});
}
export async function PUT(req: Request, { params }: { params?: { path?: string[] } } = {}) {
    return proxy(req, params || {});
}
export async function DELETE(req: Request, { params }: { params?: { path?: string[] } } = {}) {
    return proxy(req, params || {});
}
export async function PATCH(req: Request, { params }: { params?: { path?: string[] } } = {}) {
    return proxy(req, params || {});
}
export async function OPTIONS(req: Request, { params }: { params?: { path?: string[] } } = {}) {
    return proxy(req, params || {});
}
