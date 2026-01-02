import { NextRequest, NextResponse } from 'next/server';

const INTERNAL_BASE = process.env.DV_INTERNAL || 'http://43.139.236.50:8866/dv';

async function proxy(req: Request | NextRequest, params?: Promise<{ path?: string[] }> | { path?: string[] }) {
    try {
        // params 在最新 Next.js 中可能是 Promise，需要先 await
        const resolvedParams = await Promise.resolve(params || {} as { path?: string[] });
        const path = (resolvedParams.path || []).join('/') || '';
        const url = new URL(INTERNAL_BASE.replace(/\/+$/, '') + '/' + path);
        // preserve query
        const incomingUrl = new URL(req.url);
        // 防止代理循环：如果 upstream 与当前请求来源为同一 hostname，则返回错误
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

        const init: any = {
            method: req.method,
            headers: forwardHeaders,
            redirect: 'manual',
        };

        if (!['GET', 'HEAD'].includes(req.method)) {
            init.body = req.body;
            try { init.duplex = 'half'; } catch (e) { /* ignore if not supported */ }
        }

        const upstream = await fetch(url.toString(), init);

        const resHeaders = new Headers();
        upstream.headers.forEach((v, k) => {
            const lk = k.toLowerCase();
            if (['connection', 'keep-alive', 'transfer-encoding', 'upgrade', 'proxy-authenticate', 'proxy-authorization'].includes(lk)) return;
            resHeaders.set(k, v);
        });

        const ct = upstream.headers.get('content-type') || '';
        if (ct.includes('text/event-stream')) {
            resHeaders.set('cache-control', 'no-cache');
        }

        return new NextResponse(upstream.body, { status: upstream.status, headers: resHeaders });
    } catch (err) {
        return new NextResponse(String(err), { status: 500 });
    }
}

export async function GET(req: NextRequest, context: { params: Promise<{ path: string[] }> }) {
    return proxy(req, context.params);
}
export async function POST(req: NextRequest, context: { params: Promise<{ path: string[] }> }) {
    return proxy(req, context.params);
}
export async function PUT(req: NextRequest, context: { params: Promise<{ path: string[] }> }) {
    return proxy(req, context.params);
}
export async function DELETE(req: NextRequest, context: { params: Promise<{ path: string[] }> }) {
    return proxy(req, context.params);
}
export async function PATCH(req: NextRequest, context: { params: Promise<{ path: string[] }> }) {
    return proxy(req, context.params);
}
export async function OPTIONS(req: NextRequest, context: { params: Promise<{ path: string[] }> }) {
    return proxy(req, context.params);
}
