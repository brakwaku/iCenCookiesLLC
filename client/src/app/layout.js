import './globals.css'

export const metadata = {
  title: 'iCen Cookies LLC',
  description: 'Web application for iCen Cookies LLC',
}

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
