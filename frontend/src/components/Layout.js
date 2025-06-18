/* frontend/src/components/Layout.js */
import React from 'react';
import Head from 'next/head';
import Header from './Header'; // Note: In Next.js, we can use relative paths like this.

const Layout = ({ children, headerProps }) => {
    return (
        <>
            <Head>
                {/* The title will now be passed in headerProps */}
                <title>{headerProps.title || 'NocturaVision'}</title>
            </Head>
            
            <Header {...headerProps} />

            <div className="page-content">
                {children}
            </div>
        </>
    );
};

export default Layout;
