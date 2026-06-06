import '../styles/globals.css'
import Head from 'next/head'

export default function MyApp({ Component, pageProps }) {
  return (
    <>
      <Head>
        <title>Mudae Hub | Premium</title>
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=0" />
        <meta name="theme-color" content="#0b0f1a" />
      </Head>
      <div className="antialiased selection:bg-pink-500/30">
        <Component {...pageProps} />
      </div>
    </>
  )
}
