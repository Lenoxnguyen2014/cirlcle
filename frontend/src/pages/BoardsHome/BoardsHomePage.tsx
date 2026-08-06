import styles from './BoardsHomePage.module.scss';

export function BoardsHomePage() {
  return (
    <div className={styles.home}>
      <h1>Welcome</h1>
      <p>Create a board from the left panel, or pick one to jump back in.</p>
    </div>
  );
}
