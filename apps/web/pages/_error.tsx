/**
 * Next.js Pages Router 호환성 레이어용 커스텀 에러 페이지.
 * App Router를 사용하는 이 프로젝트에서는 실제로 렌더링되지 않으며,
 * 빌드 시 Next.js 내부 _error 페이지의 <Html> 오류를 방지하기 위해 존재합니다.
 */
function Error({ statusCode }: { statusCode?: number }) {
  return (
    <p>
      {statusCode
        ? `서버에서 ${statusCode} 오류가 발생했습니다.`
        : '클라이언트에서 오류가 발생했습니다.'}
    </p>
  );
}

Error.getInitialProps = ({ res, err }: { res?: { statusCode: number }; err?: { statusCode: number } }) => {
  const statusCode = res ? res.statusCode : err ? err.statusCode : 404;
  return { statusCode };
};

export default Error;
