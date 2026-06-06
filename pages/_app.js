import '../styles/globals.css'
import Head from 'next/head'
import { Inter } from 'next/font/google'

// This optimizes the font so it doesn't "jump" when the page loads
const inter = Inter({ subsets: ['latin'] })

function MyApp({ Component, pageProps }) {
  return (
    <div className={inter.className}>
      <Head>
        {/* Browser Tab Title */}
        <title>Mudae Hub | Optimized Harem Tracker</title>
        
        {/* Makes the site fit perfectly on iPhone/Android without zooming issues */}
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=0" />
        
        {/* Theme color for mobile browser bars */}
        <meta name="theme-color" content="#0b0f1a" />
        
        {/* SEO - Makes the site look good when shared on Discord/WhatsApp */}
        <meta name="description" content="Real-time Mudae character tracking and trade hub." />
        <meta property="og:title" content="Mudae Hub" />
        <meta property="og:description" content="The ultimate dashboard for your Mudae Harem." />
        <meta property="og:type" content="website" />
      </Head>

      {/* The actual app logic starts here */}
      <Component {...pageProps} />

      <style jsx global>{`
        /* Smooth scrolling for the whole page */
        html {
          scroll-behavior: smooth;
        }

        /* Custom Scrollbar for a "Pro" look */
        ::-webkit-scrollbar {
          width: 6px;
        }
        ::-webkit-scrollbar-track {
          background: #0b0f1a;
        }
        ::-webkit-scrollbar-thumb {
          background: #1e293b;
          border-radius: 10px;
        }
        ::-webkit-scrollbar-thumb:hover {
          background: #db2777; /* Pink hover color */
        }
      `}</style>
    </div>
  )
}

export default MyApp
