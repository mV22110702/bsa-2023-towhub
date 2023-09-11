import { type FC } from 'react';

import {
  useAppDispatch,
  useAppSelector,
  useCallback,
  useEffect,
  useState,
} from '~/libs/hooks/hooks.js';
import { socketAddDefaultListeners } from '~/libs/packages/socket/libs/helpers/helpers.js';
import { socket as socketService } from '~/libs/packages/socket/socket.js';
import { type TabName } from '~/libs/types/types.js';
import { Sidebar } from '~/pages/dashboard/components/sidebar/sidebar.js';
import { selectUser } from '~/slices/auth/selectors.js';

import { Header } from '../header/header.js';
import { RouterOutlet } from '../router/router.js';
import styles from './styles.module.scss';

type Properties = {
  isHeaderHidden?: boolean;
  isSidebarHidden?: boolean;
  children?: JSX.Element;
};

const PageLayout: FC<Properties> = ({
  isHeaderHidden = false,
  isSidebarHidden = false,
  children,
}: Properties) => {
  const user = useAppSelector(selectUser);
  const [selectedTab, setSelectedTab] = useState<TabName>('orders');
  const dispatch = useAppDispatch();

  const handleTabSelect = useCallback(
    (tabName: TabName) => setSelectedTab(tabName),
    [],
  );

  useEffect(() => {
    socketService.connect(user);

    socketAddDefaultListeners(dispatch);

    return () => {
      socketService.disconnect();
    };
  }, [user, dispatch]);

  return (
    <div className={styles.container}>
      {!isHeaderHidden && (
        <div className={styles.header}>
          <Header />
        </div>
      )}
      {!isSidebarHidden && (
        <div className={styles.sidebar}>
          <Sidebar selectedTab={selectedTab} onTabClick={handleTabSelect} />
        </div>
      )}
      <main className={styles.content}>
        <RouterOutlet />
        {children}
      </main>
    </div>
  );
};

export { PageLayout };
